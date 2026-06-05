export type Job = {
  id: string;
  name: string;
  version: string;
  path: string;
  description?: string;
  createdAt: Date;
  modifiedAt: Date;
  status: JobStatus;
  components: JobComponent[];
  connections: JobConnection[];
};

export type JobStatus = "development" | "production" | "archived";

export type JobComponent = {
  id: string;
  name: string;
  type: string;
  configuration: Record<string, unknown>;
  position: { x: number; y: number };
};

export type JobConnection = {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  schema?: Record<string, unknown>;
};

export type JobMetadata = {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
  status: JobStatus;
  description: string;
};

export type ListJobsOptions = {
  path?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
};

export type CreateJobOptions = {
  name: string;
  path: string;
  description?: string;
  status?: JobStatus;
};

export type ReadJobOptions = {
  includeComponents?: boolean;
  includeConnections?: boolean;
};

export type PatchComponentOptions = {
  jobId: string;
  componentId: string;
  configuration: Record<string, unknown>;
};

export type JobSafetyConfig = {
  readOnly: boolean;
  destructive: boolean;
  requiresConfirmation: boolean;
};