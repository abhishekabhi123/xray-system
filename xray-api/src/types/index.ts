export interface Run {
  id: string;
  pipelineName: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date;
  input?: any;
  output?: any;
  metadata: Record<string, any>;
  steps?: Step[];
}

export interface Step {
  id: string;
  runId: string;
  stepName: string;
  stepType: "llm" | "api" | "filter" | "rank" | "transform";
  stepIndex: number;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  input?: any;
  output?: any;
  candidatesIn?: number;
  candidatesOut?: number;
  reasoning?: string;
  filtersApplied?: FilterData[];
  metadata?: Record<string, any>;
  candidates?: Candidate[];
}

export interface FilterData {
  filterName: string;
  filterType: string;
  parameters?: Record<string, any>;
  candidatesBefore: number;
  candidatesAfter: number;
  eliminationRate: number;
}

export interface Candidate {
  id?: string;
  stepId: string;
  candidateData: any;
  data: any;
  status: "accepted" | "rejected" | "filtered_out";
  score?: number;
  reason?: string;
  rejectionReason?: string;
  rejectionFilter?: string;
}

export interface QueryFilter {
  pipelineName?: string;
  status?: string;
  minEliminationRate?: number;
  stepName?: string;
  startDate?: Date;
  endDate?: Date;
}
