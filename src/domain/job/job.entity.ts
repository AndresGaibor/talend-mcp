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
  rawNodeData?: unknown;
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

export type SchemaIssue = {
  component: string;
  schema?: string;
  column?: string;
  issue: "empty-column-name" | "null-column-name";
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