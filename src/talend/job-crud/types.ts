export interface CreateJobOptions {
  jobName: string;
  version: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
}

export interface RenameJobOptions {
  oldJobName: string;
  newJobName: string;
  folderPath?: string;
}

export interface DuplicateJobOptions {
  sourceJobName: string;
  sourceFolderPath?: string;
  targetJobName: string;
  targetVersion?: string;
  targetFolderPath?: string;
}

export interface MoveJobOptions {
  jobName: string;
  folderPath: string;
}

export interface CreateJobletOptions {
  jobletName: string;
  version: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
}
