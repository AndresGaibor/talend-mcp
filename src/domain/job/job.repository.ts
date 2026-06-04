export interface IJobRepository {
  listJobs(projectPath: string): Promise<string[]>;
  findJob(itemPath: string): Promise<string>;
  createJob(projectPath: string, name: string, spec?: JobSpec): Promise<string>;
  deleteJob(itemPath: string): Promise<void>;
  renameJob(itemPath: string, newName: string): Promise<string>;
  duplicateJob(itemPath: string, newName: string): Promise<string>;
  moveJob(itemPath: string, newFolderPath: string): Promise<string>;
  parseJob(itemPath: string): Promise<ParsedJob>;
  writeJob(itemPath: string, job: ParsedJob): Promise<void>;
  writeJobProperties(itemPath: string, properties: Record<string, string>): Promise<void>;
}

export interface ParsedJob {
  itemPath: string;
  components: import("./job.entity").TalendComponent[];
  connections: import("./job.entity").TalendConnection[];
  contexts: import("./job.entity").TalendContextParameter[];
  mapperEntries: import("./job.entity").MapperEntry[];
}

export interface JobSpec {
  name: string;
  version?: string;
  components?: import("./job.types").JobComponentSpec[];
  connections?: import("./job.types").ConnectionSpec[];
  contextParameters?: import("./job.types").ContextParameterSpec[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

import type { JobComponentSpec, ConnectionSpec, ContextParameterSpec, PipelineSpec } from "./job.types";