import { v4 as uuidV4 } from "uuid";

export interface RunConfig {
  apiUrl?: string;
  sampling?: SamplingConfig;
}

export interface SamplingConfig {
  keepAllOutputs: boolean;
  keepThresholdCandidates: number;
  sampleRate: number;
}

export interface StepData {
  stepName: string;
  stepType: "llm" | "api" | "filter" | "rank" | "transform";
  input?: any;
  output?: any;
  candidatesIn?: number;
  candidatesOut?: number;
  reasoning: string;
  filterApplied: FilterData[];
  metadata?: Record<string, any>;
}

export interface FilterData {
  filterName: string;
  filterType: string;
  parameters?: Record<string, any>;
  candidateBefore: number;
  candidatesAfter: number;
  eliminationRate: number;
}

export interface CandidateData {
  data: any;
  status: "accepted" | "rejected" | "filtered_out";
  score?: number;
  rejectionReason?: string;
  rejectionFilter?: string;
}

export class XRaySDK {
  private apiUrl: string;
  private sampling: SamplingConfig;

  constructor(config: RunConfig = {}) {
    this.apiUrl = config.apiUrl || "http://localhost:3000/api";
    this.sampling = config.sampling || {
      keepAllOutputs: true,
      keepThresholdCandidates: 10,
      sampleRate: 0.01,
    };
  }

  startRun(
    pipelineName: string,
    input: any,
    metadata?: Record<string, any>
  ): Run {
    return new Run(pipelineName, input, this.apiUrl, this.sampling, metadata);
  }
}

export class Run {
  public id: string;
  private pipelineName: string;
  private input: any;
  private output?: any;
  private steps: Step[] = [];
  private startedAt: Date;
  private completedAt?: Date;
  private status: "running" | "completed" | "failed" = "running";
  private apiUrl: string;
  private sampling: SamplingConfig;
  private metadata?: Record<string, any>;

  constructor(
    pipelineName: string,
    input: any,
    apiUrl: string,
    sampling: SamplingConfig,
    metadata?: Record<string, any>
  ) {
    this.id = uuidV4();
    this.pipelineName = pipelineName;
    this.input = input;
    this.startedAt = new Date();
    this.apiUrl = apiUrl;
    this.sampling = sampling;
    this.metadata = metadata;
  }

  addStep(
    stepName: string,
    stepType: StepData["stepType"] = "transform"
  ): Step {
    const step = new Step(
      this.id,
      stepName,
      stepType,
      this.steps.length,
      this.sampling
    );
    this.steps.push(step);
    return step;
  }

  async complete(output: any): Promise<void> {
    this.output = output;
    this.completedAt = new Date();
    this.status = "completed";
    await this.send();
  }

  async fail(error: Error): Promise<void> {
    this.completedAt = new Date();
    this.status = "failed";
    this.metadata = { ...this.metadata, error: error.message };
    await this.send();
  }

  private async send(): Promise<void> {
    try {
      const payload = {
        id: this.id,
        pipelineName: this.pipelineName,
        status: this.status,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        input: this.input,
        output: this.output,
        metadata: this.metadata,
        steps: this.steps.map((s) => s.toJSON()),
      };

      fetch(`${this.apiUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.error("FAILED TO SEND TRACE", err.message);
      });
    } catch (error) {
      console.error("Error sending trace", error);
    }
  }

  toJSON() {
    return {
      id: this.id,
      pipelineName: this.pipelineName,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      input: this.input,
      output: this.output,
      metadata: this.metadata,
      steps: this.steps.map((s) => s.toJSON()),
    };
  }
}

export class Step {
  public id: string;
  public runId: string;
  private stepName: string;
  private stepType: StepData["stepType"];
  private stepIndex: number;
  private startedAt: Date;
  private completedAt?: Date;
  private input?: any;
  private output?: any;
  private candidatesIn?: number;
  private candidatesOut?: number;
  private candidates: CandidateData[] = [];
  private reasoning?: string;
  private filtersApplied: FilterData[] = [];
  private metadata?: Record<string, any>;
  private sampling: SamplingConfig;

  constructor(
    runId: string,
    stepName: string,
    stepType: StepData["stepType"],
    stepIndex: number,
    sampling: SamplingConfig
  ) {
    this.id = uuidV4();
    this.runId = runId;
    this.stepName = stepName;
    this.stepType = stepType;
    this.stepIndex = stepIndex;
    this.startedAt = new Date();
    this.sampling = sampling;
  }

  recordInput(input: any): this {
    this.input = input;
    return this;
  }

  recordOutput(output: any): this {
    this.output = output;
    this.completedAt = new Date();
    return this;
  }

  recordCandidates(
    candidates: any,
    status: CandidateData["status"] = "accepted"
  ): this {
    const sampled = this.sampleCandidates(candidates, status);
    this.candidates.push(...sampled);
    if (status === "accepted") {
      this.candidatesOut = candidates.length;
    }
    return this;
  }

  recordFiltering(
    candidatesIn: any[],
    candidatesOut: any[],
    filterName: string,
    filterType: string,
    parameters?: Record<string, any>
  ): this {
    this.candidatesIn = candidatesIn.length;
    this.candidatesOut = candidatesOut.length;

    const eliminationRate = 1 - candidatesOut.length / candidatesIn.length;
    this.filtersApplied.push({
      filterName,
      filterType,
      parameters,
      candidateBefore: candidatesIn.length,
      candidatesAfter: candidatesOut.length,
      eliminationRate,
    });

    const rejected = candidatesIn.filter((c) => !candidatesOut.includes(c));
    const rejectedSampled = this.sampleCandidates(
      rejected,
      "rejected",
      filterName
    );
    this.candidates.push(...rejectedSampled);

    const accepted = this.sampleCandidates(candidatesOut, "accepted");
    this.candidates.push(...accepted);

    return this;
  }

  recordLLMDecision(reasoning: string, candidatesOut?: number): this {
    this.reasoning = reasoning;
    this.stepType = "llm";
    if (candidatesOut !== undefined) {
      this.candidatesOut = candidatesOut;
    }
    return this;
  }

  setMetadata(metadata: Record<string, any>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  private sampleCandidates(
    candidates: any[],
    status: CandidateData["status"],
    rejectionFilter?: string
  ): CandidateData[] {
    if (status === "accepted" && this.sampling.keepAllOutputs) {
      return candidates.map((c) => ({
        data: c,
        status,
      }));
    }

    if (status === "rejected") {
      const sampleSize = Math.ceil(
        candidates.length * this.sampling.sampleRate
      );
      const sampled = candidates.slice(0, Math.max(sampleSize, 5));
      return sampled.map((c) => ({
        data: c,
        status,
        rejectionFilter,
      }));
    }

    return candidates.map((c) => ({ data: c, status }));
  }
  toJSON() {
    return {
      id: this.id,
      runId: this.runId,
      stepName: this.stepName,
      stepType: this.stepType,
      stepIndex: this.stepIndex,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.completedAt
        ? this.completedAt.getTime() - this.startedAt.getTime()
        : undefined,
      input: this.input,
      output: this.output,
      candidatesIn: this.candidatesIn,
      candidatesOut: this.candidatesOut,
      candidates: this.candidates,
      reasoning: this.reasoning,
      filtersApplied: this.filtersApplied,
      metadata: this.metadata,
    };
  }
}
