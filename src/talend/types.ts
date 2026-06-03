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

export type TalendColumn = {
  name: string;
  type?: string;
  length?: number;
  precision?: number;
  nullable?: boolean;
  key?: boolean;
  sourceType?: string;
  pattern?: string;
};

export type TalendSchema = {
  connector?: string;
  name?: string;
  label?: string;
  columns: TalendColumn[];
};

export type TalendComponent = {
  uniqueName: string;
  componentName: string;
  label?: string;
  nodeAttributes: Record<string, string>;
  parameters: Record<string, string>;
  schemas: TalendSchema[];
  rawNodeData?: any;
};

export type TalendConnection = {
  connectorName?: string;
  label?: string;
  metaname?: string;
  source: string;
  target: string;
  uniqueName?: string;
};

export type TalendContextParameter = {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
};

export type MapperEntry = {
  table: string;
  name: string;
  expression?: string;
  type?: string;
  nullable?: boolean;
};

export type ParsedJob = {
  itemPath: string;
  components: TalendComponent[];
  connections: TalendConnection[];
  contexts: TalendContextParameter[];
  mapperEntries: MapperEntry[];
};

export type TalendComponentLink = TalendConnection;

export type TalendComponentInspection = {
  component: TalendComponent;
  incomingConnections: TalendComponentLink[];
  outgoingConnections: TalendComponentLink[];
  raw?: {
    nodeAttributes: Record<string, string>;
  };
};

export type TalendJobInspection = {
  job: ParsedJob;
  components: TalendComponentInspection[];
  connections: TalendConnection[];
  contexts: TalendContextParameter[];
  mapperEntries: MapperEntry[];
  schemaIssues: SchemaIssue[];
  stats: {
    componentCount: number;
    connectionCount: number;
    contextCount: number;
    mapperEntryCount: number;
    schemaIssueCount: number;
  };
};

export type TalendJobResource = {
  label: string;
  version: string;
  folderPath?: string;
  purpose?: string;
  description?: string;
  itemPath: string;
  propertiesPath: string;
};

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

export type SchemaIssue = {
  component: string;
  schema?: string;
  column?: string;
  issue: "empty-column-name" | "null-column-name";
};

export type RunLogStatus = "success" | "error" | "unknown";

export type RunLogEntry = {
  timestamp?: string;
  line: number;
  message: string;
};

export type LatestRunLog = {
  jobName: string;
  status: RunLogStatus;
  latestCommand?: RunLogEntry;
  latestError?: RunLogEntry;
  errors: RunLogEntry[];
};
