import * as z from "zod/v4";

export const parameterSchema = z.object({
  value: z.string().describe("Valor del parametro"),
  field: z.string().optional().describe("Tipo de campo: TEXT, CHECK, RADIO, FILE..."),
  literal: z
    .boolean()
    .optional()
    .describe("Fuerza el valor entre comillas (literal Java). Por defecto se deduce del valor"),
});

const columnSpecSchema = z.object({
  name: z.string().describe("Nombre de la columna"),
  type: z.string().optional().describe("Tipo Java: id_String, id_Integer, id_Long, id_Double, id_BigDecimal, id_Boolean, id_Date"),
  length: z.number().optional().describe("Longitud"),
  precision: z.number().optional().describe("Precision"),
  nullable: z.boolean().optional().describe("Admite nulos"),
  key: z.boolean().optional().describe("Es clave"),
  pattern: z.string().optional().describe("Patron de la fecha"),
  comment: z.string().optional().describe("Comentario"),
  sourceType: z.string().optional().describe("Tipo en el origen"),
});

const schemaTableSchema = z.object({
  connector: z.string().optional().default("FLOW").describe("Conector: FLOW, REJECT, VAR..."),
  name: z.string().describe("Nombre de la tabla. En FLOW suele ser el unique name del nodo"),
  columns: z.array(columnSpecSchema).describe("Columnas de la tabla"),
});

const tableSpecSchema = z.object({
  columns: z.array(z.string()).optional().describe("Codigos de columna de la tabla"),
  rows: z
    .array(z.union([z.array(z.string()), z.record(z.string(), z.string())]))
    .optional()
    .describe("Filas de la tabla: una por registro, como array o como objeto con las claves de columna"),
});

// Estrictos a proposito: con `z.object` una clave desconocida (un `expression`
// puesto a nivel de tabla, por ejemplo) se descarta en silencio y el tMap sale
// sin esa expresion. Con `strictObject` el error nombra la clave.
const mapperEntrySchema = z.strictObject({
  name: z.string().describe("Nombre de la columna"),
  type: z.string().optional().describe("Tipo Java de la columna"),
  expression: z.string().optional().describe("Expresion de la columna"),
  nullable: z.boolean().optional().describe("Admite nulos"),
  operator: z.string().optional().describe("Operador de la columna, si el tMap lo usa"),
});

const mapperTableSchema = z.strictObject({
  name: z
    .string()
    .describe(
      "Nombre de la tabla: el de la conexion a la que va, tal como lo pone Studio al conectar (row1, row2...). No se inventa: out1 o Var no existen como conexiones",
    ),
  columns: z.array(mapperEntrySchema).optional().describe("Columnas de la tabla"),
  filter: z.string().optional().describe("Filtro de la tabla"),
  matchingMode: z.string().optional().describe("Modo de emparejado del lookup: UNIQUE_MATCH, MULTI_MATCH..."),
  lookupMode: z.string().optional().describe("Modo de carga del lookup: LOAD_ONCE, LOAD_EACH..."),
  innerJoin: z.boolean().optional().describe("El join es inner"),
  reject: z.boolean().optional().describe("Es la tabla de rechazo"),
  rejectInnerJoin: z.boolean().optional().describe("El rechazo es inner join"),
  isJoinTableOf: z.string().optional().describe("Tabla principal del join"),
});

// Una variable de la seccion Var: nombre, tipo y expresion, sin columnas.
const mapperVarSchema = z.strictObject({
  name: z.string().describe("Nombre de la variable"),
  type: z.string().optional().describe("Tipo Java de la variable: id_String, id_Integer..."),
  expression: z.string().optional().describe("Expresion de la variable"),
  nullable: z.boolean().optional().describe("Admite nulos"),
});

const mapperSchema = z.object({
  inputs: z
    .array(mapperTableSchema)
    .optional()
    .describe("Tablas de entrada: una por conexion de entrada, con el nombre de esa conexion"),
  outputs: z
    .array(mapperTableSchema)
    .optional()
    .describe("Tablas de salida: una por conexion de salida, con el nombre de esa conexion y la expresion de cada columna"),
  vars: z.array(mapperVarSchema).optional().describe("Variables de la seccion Var"),
});

/** Configuracion declarativa compartida por las operaciones de nodos. */
export const componentSpecShape = {
  parameters: z.record(z.string(), parameterSchema).optional().describe("Parametros del componente"),
  tables: z.record(z.string(), tableSpecSchema).optional().describe("Tablas del componente (parametros de tipo TABLE)"),
  schema: z.array(schemaTableSchema).optional().describe("Metadata del nodo, por conector y por tabla"),
  mapper: mapperSchema.optional().describe("Modelo del tMap: transformaciones, filtros y joins"),
};

export const columnSchema = z.object({
  name: z.string().describe("Nombre de la columna"),
  type: z.string().optional().describe("Tipo Java: id_String, id_Integer, id_Long, id_Double, id_BigDecimal, id_Boolean, id_Date"),
  length: z.number().optional().describe("Longitud"),
  precision: z.number().optional().describe("Precision"),
  nullable: z.boolean().optional().describe("Admite nulos"),
  key: z.boolean().optional().describe("Es clave"),
});
