export type TalendWorkspace = {
  workspacePath: string;
  projectPath: string;
  projectName: string;
  metadataPath: string;
};

export type OpenJob = {
  projectName?: string;
  jobName: string;
  version: string;
  label: string;
  workbenchPath: string;
  itemPath?: string;
  selected: boolean;
};

export type LaunchConfig = {
  currentProjectName?: string;
  jobProjectTechLabel?: string;
  jobId?: string;
  jobName?: string;
  jobVersion?: string;
  path: string;
};