import { Router, Request, Response } from "express";
import pool from "../db/database";
import { Run, Step, Candidate, QueryFilter } from "../types";

const router = Router();

router.post("/runs", async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const run: Run = req.body;

    await client.query(
      `INSERT INTO runs (id, pipeline_name, status, started_at, completed_at, input, output, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        run.id,
        run.pipelineName,
        run.status,
        run.startedAt,
        run.completedAt,
        JSON.stringify(run.input),
        run.output ? JSON.stringify(run.output) : null,
        run.metadata ? JSON.stringify(run.metadata) : null,
      ]
    );

    if (run.steps && run.steps.length > 0) {
      for (const step of run.steps) {
        await client.query(
          `INSERT INTO steps (
            id, run_id, step_name, step_type, step_index, 
            started_at, completed_at, duration_ms, input, output,
            candidates_in, candidates_out, reasoning, filters_applied, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            step.id,
            run.id,
            step.stepName,
            step.stepType,
            step.stepIndex,
            step.startedAt,
            step.completedAt,
            step.durationMs,
            step.input ? JSON.stringify(step.input) : null,
            step.output ? JSON.stringify(step.output) : null,
            step.candidatesIn,
            step.candidatesOut,
            step.reasoning,
            step.filtersApplied ? JSON.stringify(step.filtersApplied) : null,
            step.metadata ? JSON.stringify(step.metadata) : null,
          ]
        );

        if (step.candidates && step.candidates.length > 0) {
          for (const candidate of step.candidates) {
            await client.query(
              `INSERT INTO candidates (
                step_id, candidate_data, status, score, reason, rejection_reason, rejection_filter
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                step.id,
                JSON.stringify(candidate.data),
                candidate.status,
                candidate.score,
                candidate.reason,
                candidate.rejectionReason,
                candidate.rejectionFilter,
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Run trace recorded successfully",
      runId: run.id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving run:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    client.release();
  }
});

// GET /api/runs/:id - Get specific run with all details
router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get run
    const runResult = await pool.query("SELECT * FROM runs WHERE id = $1", [
      id,
    ]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Run not found",
      });
    }

    const run = runResult.rows[0];

    // Get steps
    const stepsResult = await pool.query(
      "SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index ASC",
      [id]
    );

    // Get candidates for each step
    const steps = await Promise.all(
      stepsResult.rows.map(async (step) => {
        // ✅ Now stepsResult is in scope
        const candidatesResult = await pool.query(
          "SELECT * FROM candidates WHERE step_id = $1",
          [step.id]
        );

        return {
          ...step,
          candidates: candidatesResult.rows,
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...run,
        steps,
      },
    });
  } catch (error) {
    console.error("Error fetching run:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const pipelineName = req.query.pipelineName as string;
    const status = req.query.status as string;

    let query = "select * from runs";
    let countQuery = "select count(*) from runs";
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (pipelineName) {
      conditions.push(`pipeline_name = $${paramIndex++}`);
      values.push(pipelineName);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const [runsResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        runs: runsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error listing runs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/runs/query - Advanced querying
router.post("/runs/query", async (req: Request, res: Response) => {
  try {
    const filter: QueryFilter = req.body;

    // Query for steps with high elimination rate
    if (filter.minEliminationRate !== undefined) {
      const query = `
        SELECT 
          r.id as run_id,
          r.pipeline_name,
          r.started_at,
          s.step_name,
          s.step_type,
          s.candidates_in,
          s.candidates_out,
          (1.0 - s.candidates_out::float / NULLIF(s.candidates_in, 0)) as elimination_rate,
          s.filters_applied
        FROM runs r
        JOIN steps s ON r.id = s.run_id
        WHERE s.candidates_in > 0
          AND (1.0 - s.candidates_out::float / s.candidates_in) >= $1
        ORDER BY elimination_rate DESC
        LIMIT 100
      `;

      const result = await pool.query(query, [filter.minEliminationRate]);

      return res.json({
        // ✅ Add 'return' here to exit early
        success: true,
        data: result.rows,
      });
    }

    // Default: return recent runs (only executes if minEliminationRate is undefined)
    const result = await pool.query(
      "SELECT * FROM runs ORDER BY started_at DESC LIMIT 50"
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    // ✅ This catch should align with the try above
    console.error("Error querying runs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
