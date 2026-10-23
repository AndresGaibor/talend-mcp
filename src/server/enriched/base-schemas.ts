import { z } from "zod/v4";

export const TalendColumnSchema = z.object({
  name: z.string().describe("Name of the column"),
  type: z.string().optional().describe("Java/Talend type of the column"),
  length: z.number().optional().describe("Length of the column"),
  precision: z.number().optional().describe("Precision of the column"),
  nullable: z.boolean().optional().describe("Whether the column is nullable"),
  key: z.boolean().optional().describe("Whether the column is part of the primary key"),
  sourceType: z.string().optional().describe("Source type"),
  pattern: z.string().optional().describe("Date or custom pattern"),
});

export const TalendSchemaSchema = z.object({
  connector: z.string().optional().describe("Connector name"),
  name: z.string().optional().describe("Name of the schema"),
  label: z.string().optional().describe("Label of the schema"),
  columns: z.array(TalendColumnSchema).describe("List of columns in this schema"),
});

export const TalendComponentSchema = z.object({
  uniqueName: z.string().describe("Unique identifier of the component in the job"),
  componentName: z.string().describe("Talend component type (e.g., tMysqlInput, tLogRow)"),
  label: z.string().optional().describe("Display label"),
  nodeAttributes: z.record(z.string(), z.string()).describe("Raw node attributes"),
  parameters: z.record(z.string(), z.string()).describe("Component parameters and values"),
  schemas: z.array(TalendSchemaSchema).describe("Associated schemas"),
  rawNodeData: z.unknown().optional(),
});

export const TalendConnectionSchema = z.object({
  connectorName: z.string().optional(),
  label: z.string().optional(),
  metaname: z.string().optional(),
  source: z.string().describe("Source component unique name"),
  target: z.string().describe("Target component unique name"),
  uniqueName: z.string().optional(),
});

export const TalendContextParameterSchema = z.object({
  name: z.string().describe("Parameter name"),
  type: z.string().optional().describe("Type of parameter (e.g. id_String)"),
  value: z.string().optional().describe("Parameter value"),
  prompt: z.string().optional().describe("UI prompt text"),
});

export const MapperEntrySchema = z.object({
  table: z.string().describe("Table name"),
  name: z.string().describe("Entry name"),
  expression: z.string().optional().describe("Mapping expression"),
  type: z.string().optional().describe("Type"),
  nullable: z.boolean().optional().describe("Nullable flag"),
});

export const ParsedJobSchema = z.object({
  itemPath: z.string().describe("Absolute file path to the job .item file"),
  components: z.array(TalendComponentSchema).describe("List of components in the job"),
  connections: z.array(TalendConnectionSchema).describe("Connections between components"),
  contexts: z.array(TalendContextParameterSchema).describe("Context parameters defined in the job"),
  mapperEntries: z.array(MapperEntrySchema).describe("Mapper entries for tMap/tXMLMap components"),
});

export const SchemaIssueSchema = z.object({
  component: z.string().describe("Component name with the schema issue"),
  schema: z.string().optional(),
  column: z.string().optional(),
  issue: z.enum(["empty-column-name", "null-column-name"]),
});

/** Entorno ("environment") dentro de un grupo de contextos del repositorio. */
export const RepositoryEnvironmentSchema = z.object({
  name: z.string().describe("Environment name inside the group (e.g. Datasets, Processes)"),
  parameters: z.array(TalendContextParameterSchema).describe("Parameters defined in this environment"),
});

/**
 * Item de tipo "Contexts" del repositorio, tal como lo devuelve el bridge:
 * nombre y versión del item, entornos con sus variables y, si el item no trae
 * entornos, los parámetros planos. `parameters` sigue siendo opcional para no
 * romper consumidores que esperan la forma plana antigua.
 */
export const RepositoryContextSchema = z.object({
  name: z.string().describe("Context group name"),
  version: z.string().optional().describe("Version of the repository item"),
  defaultContext: z.string().optional().describe("Environment used by default"),
  contexts: z
    .array(RepositoryEnvironmentSchema)
    .optional()
    .describe("Environments of the group with their parameters"),
  parameters: z
    .array(TalendContextParameterSchema)
    .optional()
    .describe("Context parameters when the group is returned without environments"),
});

export const DQIndicatorSchema = z.object({
  name: z.string(),
  type: z.string(),
  computed: z.boolean(),
  count: z.number().optional(),
  length: z.number().optional(),
  distinctValueCount: z.number().optional(),
  valueToFreq: z.string().optional(),
  analyzedElement: z.string(),
});

export const DqAnalysisSchema = z.object({
  name: z.string(),
  status: z.string(),
  purpose: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  defaultContext: z.string(),
  lastRunOk: z.boolean(),
  lastRunDate: z.string().optional(),
  lastRunDuration: z.number().optional(),
  connectionName: z.string(),
  connectionPath: z.string(),
  columnCount: z.number(),
  analyzedColumns: z.array(z.string()),
  indicators: z.array(DQIndicatorSchema),
  filePath: z.string(),
});

export const ExportedJobScriptSchema = z.object({
  jobName: z.string(),
  scriptPath: z.string(),
  platform: z.enum(["windows", "posix"]),
  folderPath: z.string(),
  modifiedAt: z.string(),
  detectedVersion: z.string().optional(),
});

export const RunHistoryEntrySchema = z.object({
  runId: z.string(),
  jobName: z.string(),
  scriptPath: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  status: z.enum(["running", "success", "error", "timeout", "killed"]),
  exitCode: z.number().nullable().optional(),
  durationMs: z.number().optional(),
  stdoutPath: z.string(),
  stderrPath: z.string(),
  metadataPath: z.string(),
});
