import type { TalendSchema } from "../job/job.entity";
import type { SchemaIssue } from "../job/job.entity";

export type TdbOutputAnalysis = {
  componentName: string;
  uniqueName: string;
  host?: string;
  port?: string;
  dbName?: string;
  user?: string;
  table?: string;
  tableAction?: string;
  dataAction?: string;
  batchSize?: string;
  schema?: TalendSchema;
};

export type ColumnIssue =
  | { type: "reserved-keyword"; column: string }
  | { type: "duplicate-column"; column: string }
  | { type: "null-name"; column: string }
  | { type: "empty-name" };

export type FullJobAnalysis = {
  jobName: string;
  issues: ColumnIssue[];
  tdbOutputs: TdbOutputAnalysis[];
  schemaIssues: SchemaIssue[];
  stats: {
    totalComponents: number;
    tMapCount: number;
    inputCount: number;
    outputCount: number;
    totalSchemaColumns: number;
  };
};

export type TalendEnvironmentReport = {
  workspacePath: string;
  projectPath: string;
  projectName: string;
  hasMetadata: boolean;
  jobCount: number;
  isRepoMode: boolean;
  studioDetected: boolean;
};