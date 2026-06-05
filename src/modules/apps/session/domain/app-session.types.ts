export type TalendAppSession = {
  id: string;
  projectPath?: string;
  selectedJob?: string;
  datasetFolder?: string;
  datasetMappings?: unknown[];
  pipelineSpec?: unknown;
  validationReport?: unknown;
  lastRunId?: string;
  evidenceFiles?: string[];
};

export type CreateSessionOptions = {
  id?: string;
  projectPath?: string;
};

export type UpdateSessionOptions = Partial<Omit<TalendAppSession, "id">>;

export type GetSessionOptions = {
  includeHistory?: boolean;
};
