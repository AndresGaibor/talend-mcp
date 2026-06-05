export interface SchemaColumn {
  name: string;
  type?: string;
  length?: number;
  precision?: number;
  nullable?: boolean;
  key?: boolean;
}

export interface ComponentSchema {
  name?: string;
  connector?: string;
  label?: string;
  columns: SchemaColumn[];
}

export interface SchemaExtractionResult {
  ok: boolean;
  schema?: ComponentSchema;
  error?: string;
}

export interface SchemaComparisonResult {
  ok: boolean;
  differences?: SchemaDifference[];
  error?: string;
}

export interface SchemaDifference {
  type: "name_mismatch" | "type_mismatch" | "missing_in_source" | "missing_in_target";
  sourceColumn?: string;
  targetColumn?: string;
  details?: string;
}

export interface MappingSuggestion {
  sourceColumn: string;
  targetColumn: string;
  confidence: number;
  reason: string;
}

export interface MappingSuggestionsResult {
  ok: boolean;
  mappings?: MappingSuggestion[];
  error?: string;
}
