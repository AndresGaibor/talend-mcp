import type { Job, JobMetadata } from "./job.types";

export type PipelineSpec = {
  name: string;
  version: string;
  description?: string;
  stages: PipelineStage[];
};

export type PipelineStage = {
  id: string;
  name: string;
  components: PipelineComponent[];
  connections: PipelineConnection[];
};

export type PipelineComponent = {
  id: string;
  name: string;
  type: string;
  configuration: Record<string, unknown>;
  position: { x: number; y: number };
};

export type PipelineConnection = {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  schema?: Record<string, unknown>;
};

export type ValidatePipelineSpecOptions = {
  spec: PipelineSpec;
  strict?: boolean;
};

export type PreviewPipelineSpecOptions = {
  spec: PipelineSpec;
  includeUnsetDefaults?: boolean;
};

export type ApplyPipelineSpecOptions = {
  jobId: string;
  spec: PipelineSpec;
  overwrite?: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

export type ValidationError = {
  path: string;
  message: string;
  code: string;
};

export type ValidationWarning = {
  path: string;
  message: string;
  code: string;
};