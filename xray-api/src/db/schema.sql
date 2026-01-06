CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY,
  pipeline_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  input JSONB,
  output JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runs_pipeline ON runs(pipeline_name);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);

CREATE TABLE IF NOT EXISTS steps (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  step_index INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  input JSONB,
  output JSONB,
  candidates_in INTEGER,
  candidates_out INTEGER,
  reasoning TEXT,
  filters_applied JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_step_name ON steps(step_name);
CREATE INDEX IF NOT EXISTS idx_steps_elimination ON steps((candidates_in - candidates_out)) WHERE candidates_in IS NOT NULL;

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_id UUID NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  candidate_data JSONB NOT NULL,
  status VARCHAR(50) NOT NULL,
  score DECIMAL,
  reason TEXT,
  rejection_reason TEXT,
  rejection_filter VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidates_step_id ON candidates(step_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
