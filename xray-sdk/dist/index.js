"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step = exports.Run = exports.XRaySDK = void 0;
const uuid_1 = require("uuid");
class XRaySDK {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || "http://localhost:3000/api";
        this.sampling = config.sampling || {
            keepAllOutputs: true,
            keepThresholdCandidates: 10,
            sampleRate: 0.01,
        };
    }
    startRun(pipelineName, input, metadata) {
        return new Run(pipelineName, input, this.apiUrl, this.sampling, metadata);
    }
}
exports.XRaySDK = XRaySDK;
class Run {
    constructor(pipelineName, input, apiUrl, sampling, metadata) {
        this.steps = [];
        this.status = "running";
        this.id = (0, uuid_1.v4)();
        this.pipelineName = pipelineName;
        this.input = input;
        this.startedAt = new Date();
        this.apiUrl = apiUrl;
        this.sampling = sampling;
        this.metadata = metadata;
    }
    addStep(stepName, stepType = "transform") {
        const step = new Step(this.id, stepName, stepType, this.steps.length, this.sampling);
        this.steps.push(step);
        return step;
    }
    async complete(output) {
        this.output = output;
        this.completedAt = new Date();
        this.status = "completed";
        await this.send();
    }
    async fail(error) {
        this.completedAt = new Date();
        this.status = "failed";
        this.metadata = { ...this.metadata, error: error.message };
        await this.send();
    }
    async send() {
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
        }
        catch (error) {
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
exports.Run = Run;
class Step {
    constructor(runId, stepName, stepType, stepIndex, sampling) {
        this.candidates = [];
        this.filtersApplied = [];
        this.id = (0, uuid_1.v4)();
        this.runId = runId;
        this.stepName = stepName;
        this.stepType = stepType;
        this.stepIndex = stepIndex;
        this.startedAt = new Date();
        this.sampling = sampling;
    }
    recordInput(input) {
        this.input = input;
        return this;
    }
    recordOutput(output) {
        this.output = output;
        this.completedAt = new Date();
        return this;
    }
    recordCandidates(candidates, status = "accepted") {
        const sampled = this.sampleCandidates(candidates, status);
        this.candidates.push(...sampled);
        if (status === "accepted") {
            this.candidatesOut = candidates.length;
        }
        return this;
    }
    recordFiltering(candidatesIn, candidatesOut, filterName, filterType, parameters) {
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
        const rejectedSampled = this.sampleCandidates(rejected, "rejected", filterName);
        this.candidates.push(...rejectedSampled);
        const accepted = this.sampleCandidates(candidatesOut, "accepted");
        this.candidates.push(...accepted);
        return this;
    }
    recordLLMDecision(reasoning, candidatesOut) {
        this.reasoning = reasoning;
        this.stepType = "llm";
        if (candidatesOut !== undefined) {
            this.candidatesOut = candidatesOut;
        }
        return this;
    }
    setMetadata(metadata) {
        this.metadata = { ...this.metadata, ...metadata };
        return this;
    }
    sampleCandidates(candidates, status, rejectionFilter) {
        if (status === "accepted" && this.sampling.keepAllOutputs) {
            return candidates.map((c) => ({
                data: c,
                status,
            }));
        }
        if (status === "rejected") {
            const sampleSize = Math.ceil(candidates.length * this.sampling.sampleRate);
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
exports.Step = Step;
