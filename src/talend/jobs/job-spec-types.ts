import type { PatrónTalend } from "../task/task-types";

export interface JobSpecComponent {
  name: string;
  componentName: string;
  type: "input" | "transform" | "output" | "iterator" | "orchestration";
  connections: Array<{ from?: string; to?: string; name?: string }>;
  parameters: Record<string, unknown>;
}

export interface JobSpecContext {
  name: string;
  type: "string" | "number" | "password" | "boolean";
  defaultValue: string;
}

// TODO: remove 'unknown' from here - temporary placeholder for now
export interface JobSpec {
  jobName: string;
  pattern: PatrónTalend;
  description: string;
  components: JobSpecComponent[];
  contexts: JobSpecContext[];
  outputTable?: string;
  inputPath?: string;
  batchSize?: number;
  appendMode?: boolean;
  auditColumns?: boolean;
  technicalColumns?: Array<{ name: string; value: string }>;
}

export interface PipelineSpec {
  pattern: PatrónTalend;
  name: string;
  description: string;
  inputs: Array<{ type: string; path?: string; table?: string }>;
  outputs: Array<{ type: string; table: string; action: string }>;
  transforms: string[];
  contexts: string[];
  auditColumns: boolean;
  batchSize: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string }>;
}
