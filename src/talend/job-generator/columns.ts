export type ColumnSpec = {
  name: string;
  type?: string;
  length?: number;
  precision?: number;
  nullable?: boolean;
  key?: boolean;
  sourceType?: string;
  pattern?: string;
};

const TALEND_COLUMN_TYPES = new Set([
  "id_String",
  "id_Integer",
  "id_Long",
  "id_Double",
  "id_Float",
  "id_BigDecimal",
  "id_Boolean",
  "id_Byte",
  "id_Short",
  "id_Character",
  "id_Date",
  "id_Password",
  "id_Dynamic",
]);

const COLUMN_TYPE_ALIASES: Record<string, string> = {
  string: "id_String",
  text: "id_String",
  varchar: "id_String",
  char: "id_Character",
  int: "id_Integer",
  integer: "id_Integer",
  long: "id_Long",
  bigint: "id_Long",
  double: "id_Double",
  float: "id_Float",
  real: "id_Double",
  decimal: "id_BigDecimal",
  numeric: "id_BigDecimal",
  bigdecimal: "id_BigDecimal",
  boolean: "id_Boolean",
  bool: "id_Boolean",
  byte: "id_Byte",
  short: "id_Short",
  date: "id_Date",
  datetime: "id_Date",
  timestamp: "id_Date",
  password: "id_Password",
};

/** Normaliza los tipos de columna al identificador Java que espera Talend. */
export function normalizeColumnType(type?: string): string {
  if (!type) return "id_String";
  if (TALEND_COLUMN_TYPES.has(type)) return type;
  return COLUMN_TYPE_ALIASES[type.toLowerCase()] ?? "id_String";
}

export function buildColumn(col: ColumnSpec): Record<string, unknown> {
  const node: Record<string, unknown> = { "@_name": col.name, "@_type": normalizeColumnType(col.type) };
  if (col.length !== undefined) node["@_length"] = String(col.length);
  if (col.precision !== undefined) node["@_precision"] = String(col.precision);
  if (col.nullable !== undefined) node["@_nullable"] = col.nullable ? "true" : "false";
  if (col.key !== undefined) node["@_key"] = col.key ? "true" : "false";
  if (col.sourceType !== undefined) node["@_sourceType"] = col.sourceType;
  if (col.pattern !== undefined) node["@_pattern"] = col.pattern;
  return node;
}
