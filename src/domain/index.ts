// Job domain
export type {
  ParsedJob,
  TalendComponent,
  TalendConnection,
  TalendColumn,
  TalendSchema,
  TalendContextParameter,
  MapperEntry,
  TalendComponentLink,
  SchemaIssue,
  TalendJobResource,
} from "./job/job.entity";

export type {
  JobSpec,
  JobComponentSpec,
  SchemaSpec,
  ColumnSpec,
  ConnectionSpec,
  ContextParameterSpec,
  ValidationResult,
  PipelineSpec,
} from "./job/job.types";

export type { IJobRepository } from "./job/job.repository";

// Workspace domain
export type {
  TalendWorkspace,
  OpenJob,
  LaunchConfig,
} from "./workspace/workspace.entity";

// Analysis domain
export type {
  TdbOutputAnalysis,
  ColumnIssue,
  FullJobAnalysis,
  TalendEnvironmentReport,
} from "./analysis/analysis.entity";

// Execution domain
export type {
  RunLogStatus,
  RunLogEntry,
  LatestRunLog,
  RunRecord,
  PerformanceMeasurement,
} from "./execution/execution.entity";

// Studio domain
export type {
  BridgeCapability,
  BridgeCommand,
  StudioBridgeClient,
} from "./studio/bridge.entity";

// Context domain
export type {
  ContextProfile,
  DatabaseConnection,
} from "./context/context.entity";

// Component domain
export type {
  MasteryLevel,
  ComponentMastery,
  MasteryReport,
} from "./component/component.entity";

// Common
export { DomainError, NotFoundError, ValidationError, InfrastructureError } from "./common/errors";
export { generateTalendId } from "./common/identifiers";