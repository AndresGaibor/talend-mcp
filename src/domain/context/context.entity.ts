export type ContextProfile = {
  name: string;
  parameters: TalendContextParameter[];
  sourceType?: string;
};

export type DatabaseConnection = {
  contextName: string;
  componentName: string;
  connectionType: string;
  host?: string;
  port?: string;
  dbName?: string;
  login?: string;
};

import type { TalendContextParameter } from "../job/job.entity";