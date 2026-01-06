import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import runsRouter from "./routes/runs";
import { initializeDatabase } from "./db/database";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

async function start() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 X-Ray API server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
