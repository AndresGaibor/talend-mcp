export { NodeCsvReaderAdapter } from "./adapters/node-csv-reader.adapter";
export { NodeFileSystemAdapter } from "./adapters/node-file-system.adapter";

export { InspectCsvFolderUseCase } from "./application/inspect-csv-folder.usecase";
export { InferCsvSchemaUseCase } from "./application/infer-csv-schema.usecase";
export { GenerateRawMappingsUseCase } from "./application/generate-raw-mappings.usecase";

export { createInspectCsvFolderTool, ALIAS_INSPECT_CSV_FOLDER } from "./tools/datasets-inspect-csv-folder.tool";
export { createInferCsvSchemaTool, ALIAS_INFER_CSV_SCHEMA } from "./tools/datasets-infer-csv-schema.tool";
export { createGenerateRawMappingsTool, ALIAS_GENERATE_RAW_MAPPINGS } from "./tools/datasets-generate-raw-mappings.tool";

export type {
  DatasetInspectionResult,
  CsvFolderInspection,
  CsvFileInfo,
  CsvColumn,
  CsvColumnType,
  SchemaInference,
  RawTableMapping,
} from "./domain/dataset.types";

export type {
  CsvSchemaDefinition,
  CsvSchemaColumn,
  RawMappingOptions,
  RawMappingResult,
  BatchRawMappingsResult,
} from "./domain/csv-schema.types";

export type { ICsvReader } from "./ports/csv-reader.port";
export type { IFileSystem } from "./ports/file-system.port";
