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
export declare class XRaySDK {
    private apiUrl;
    private sampling;
    constructor(config?: RunConfig);
    startRun(pipelineName: string, input: any, metadata?: Record<string, any>): Run;
}
export declare class Run {
    id: string;
    private pipelineName;
    private input;
    private output?;
    private steps;
    private startedAt;
    private completedAt?;
    private status;
    private apiUrl;
    private sampling;
    private metadata?;
    constructor(pipelineName: string, input: any, apiUrl: string, sampling: SamplingConfig, metadata?: Record<string, any>);
    addStep(stepName: string, stepType?: StepData["stepType"]): Step;
    complete(output: any): Promise<void>;
    fail(error: Error): Promise<void>;
    private send;
    toJSON(): {
        id: string;
        pipelineName: string;
        status: "running" | "completed" | "failed";
        startedAt: Date;
        completedAt: Date | undefined;
        input: any;
        output: any;
        metadata: Record<string, any> | undefined;
        steps: {
            id: string;
            runId: string;
            stepName: string;
            stepType: "llm" | "api" | "filter" | "rank" | "transform";
            stepIndex: number;
            startedAt: Date;
            completedAt: Date | undefined;
            durationMs: number | undefined;
            input: any;
            output: any;
            candidatesIn: number | undefined;
            candidatesOut: number | undefined;
            candidates: CandidateData[];
            reasoning: string | undefined;
            filtersApplied: FilterData[];
            metadata: Record<string, any> | undefined;
        }[];
    };
}
export declare class Step {
    id: string;
    runId: string;
    private stepName;
    private stepType;
    private stepIndex;
    private startedAt;
    private completedAt?;
    private input?;
    private output?;
    private candidatesIn?;
    private candidatesOut?;
    private candidates;
    private reasoning?;
    private filtersApplied;
    private metadata?;
    private sampling;
    constructor(runId: string, stepName: string, stepType: StepData["stepType"], stepIndex: number, sampling: SamplingConfig);
    recordInput(input: any): this;
    recordOutput(output: any): this;
    recordCandidates(candidates: any, status?: CandidateData["status"]): this;
    recordFiltering(candidatesIn: any[], candidatesOut: any[], filterName: string, filterType: string, parameters?: Record<string, any>): this;
    recordLLMDecision(reasoning: string, candidatesOut?: number): this;
    setMetadata(metadata: Record<string, any>): this;
    private sampleCandidates;
    toJSON(): {
        id: string;
        runId: string;
        stepName: string;
        stepType: "llm" | "api" | "filter" | "rank" | "transform";
        stepIndex: number;
        startedAt: Date;
        completedAt: Date | undefined;
        durationMs: number | undefined;
        input: any;
        output: any;
        candidatesIn: number | undefined;
        candidatesOut: number | undefined;
        candidates: CandidateData[];
        reasoning: string | undefined;
        filtersApplied: FilterData[];
        metadata: Record<string, any> | undefined;
    };
}
