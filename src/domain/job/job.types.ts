export interface JobSpec {
  name: string;
  version?: string;
  components?: JobComponentSpec[];
  connections?: ConnectionSpec[];
  contextParameters?: ContextParameterSpec[];
}

export interface JobComponentSpec {
  componentName: string;
  uniqueName: string;
  label?: string;
  parameters?: Record<string, string>;
  schemas?: SchemaSpec[];
}

export interface SchemaSpec {
  name?: string;
  connector?: string;
  columns: ColumnSpec[];
}

export interface ColumnSpec {
  name: string;
  type?: string;
  length?: number;
  nullable?: boolean;
}

export interface ConnectionSpec {
  source: string;
  target: string;
  label?: string;
  metaname?: string;
}

export interface ContextParameterSpec {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PipelineSpec {
  pattern: string;
  jobs: JobSpec[];
}