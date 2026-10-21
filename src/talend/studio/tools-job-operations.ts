import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";

/**
 * Tools para operar sobre el job abierto en Talend Studio.
 *
 * Usan la API del propio IDE, no escriben el XML a mano. Cada componente nace
 * con los parametros y valores por defecto que pone Talend, y el formato lo
 * escribe Studio.
 */

const parameterSchema = z.object({
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

const mapperEntrySchema = z.object({
  name: z.string().describe("Nombre de la columna"),
  type: z.string().optional().describe("Tipo Java de la columna"),
  expression: z.string().optional().describe("Expresion de la columna"),
  nullable: z.boolean().optional().describe("Admite nulos"),
});

const mapperTableSchema = z.object({
  name: z.string().describe("Nombre de la tabla: row1, out1, Var..."),
  columns: z.array(mapperEntrySchema).optional().describe("Columnas de la tabla"),
  filter: z.string().optional().describe("Filtro de la tabla"),
  matchingMode: z.string().optional().describe("Modo de emparejado del lookup: UNIQUE_MATCH, MULTI_MATCH..."),
  lookupMode: z.string().optional().describe("Modo de carga del lookup: LOAD_ONCE, LOAD_EACH..."),
  innerJoin: z.boolean().optional().describe("El join es inner"),
  reject: z.boolean().optional().describe("Es la tabla de rechazo"),
  rejectInnerJoin: z.boolean().optional().describe("El rechazo es inner join"),
  isJoinTableOf: z.string().optional().describe("Tabla principal del join"),
});

const mapperSchema = z.object({
  inputs: z.array(mapperTableSchema).optional().describe("Tablas de entrada"),
  outputs: z.array(mapperTableSchema).optional().describe("Tablas de salida"),
  vars: z.array(mapperTableSchema).optional().describe("Variables de la seccion Var"),
});

/**
 * Configuracion declarativa de un componente.
 *
 * Es la misma para todos los componentes: parametros, tablas, schema y, para
 * los que lo tienen (el tMap), su modelo propio.
 */
const componentSpecShape = {
  parameters: z.record(z.string(), parameterSchema).optional().describe("Parametros del componente"),
  tables: z.record(z.string(), tableSpecSchema).optional().describe("Tablas del componente (parametros de tipo TABLE)"),
  schema: z.array(schemaTableSchema).optional().describe("Metadata del nodo, por conector y por tabla"),
  mapper: mapperSchema.optional().describe("Modelo del tMap: transformaciones, filtros y joins"),
};

const columnSchema = z.object({
  name: z.string().describe("Nombre de la columna"),
  type: z.string().optional().describe("Tipo Java: id_String, id_Integer, id_Long, id_Double, id_BigDecimal, id_Boolean, id_Date"),
  length: z.number().optional().describe("Longitud"),
  precision: z.number().optional().describe("Precision"),
  nullable: z.boolean().optional().describe("Admite nulos"),
  key: z.boolean().optional().describe("Es clave"),
});

export const jobOperationsTools = [
  {
    name: "talend_job_create_in_studio",
    description: "Crea un job vacio en el repositorio de Talend y lo abre en el editor. El job se crea con la API del IDE, no escribiendo el XML a mano.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job. Solo letras, digitos y guion bajo"),
      version: z.string().optional().default("0.1").describe("Version del job"),
      folder: z.string().optional().default("").describe("Carpeta dentro de process/"),
      description: z.string().optional().describe("Descripcion del job"),
      replace: z.boolean().optional().default(false).describe("Reemplaza el job si ya existe con esa etiqueta"),
    }),
    handler: async ({ name, version, folder, description, replace }: { name: string; version?: string; folder?: string; description?: string; replace?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.createJob({ name, version, folder, description, replace });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/create",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_delete_in_studio",
    description: "Borra un job del repositorio de Talend, con sus archivos. Se borra desde el repositorio, no desde el disco, para que no quede un item fantasma.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Version del job"),
    }),
    handler: async ({ name, version }: { name: string; version?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.deleteJob({ name, version });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/delete",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_dismiss_dialogs",
    description: "Cierra los dialogos modales que bloquean Talend Studio (por ejemplo el 'Jobname Error' al reusar la etiqueta de un job). El plugin ya lo hace solo; esta tool lo fuerza bajo demanda.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.dismissDialogs();
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/workbench/dialogs",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_open_in_studio",
    description: "Abre un job del proyecto en el editor de Talend. Necesario antes de operar sobre sus nodos.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Version del job"),
    }),
    handler: async ({ name, version }: { name: string; version?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.openJob({ name, version });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/open",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_add_node",
    description: "Anade un componente al job abierto. El componente se crea con la API de Studio, con todos sus parametros por defecto, y se configura de forma declarativa (parametros, tablas, schema y, en el tMap, sus transformaciones).",
    inputSchema: z.object({
      type: z.string().describe("Nombre del componente: tFileInputDelimited, tLogRow, tMap, tMysqlOutput..."),
      label: z.string().optional().describe("Etiqueta del componente"),
      position: z.object({ x: z.number(), y: z.number() }).optional().describe("Posicion en el lienzo"),
      ...componentSpecShape,
      job: z.string().optional().describe("Job a abrir si no hay ninguno abierto"),
    }),
    handler: async ({ type, label, position, parameters, tables, schema, mapper, job }: {
      type: string;
      label?: string;
      position?: { x: number; y: number };
      parameters?: Record<string, { value: string; field?: string; literal?: boolean }>;
      tables?: Record<string, { columns?: string[]; rows?: Array<string[] | Record<string, string>> }>;
      schema?: Array<{ connector?: string; name: string; columns: Array<Record<string, unknown>> }>;
      mapper?: Record<string, unknown>;
      job?: string;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.addNode({ type, label, position, parameters, tables, schema, mapper });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/add",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_configure_node",
    description: "Configura un componente ya anadido al job: sus parametros, sus tablas, su schema o las transformaciones de un tMap. Es la via para retocar un job existente sin recrearlo.",
    inputSchema: z.object({
      uniqueName: z.string().describe("Unique name del nodo"),
      ...componentSpecShape,
    }),
    handler: async ({ uniqueName, parameters, tables, schema, mapper }: {
      uniqueName: string;
      parameters?: Record<string, { value: string; field?: string; literal?: boolean }>;
      tables?: Record<string, { columns?: string[]; rows?: Array<string[] | Record<string, string>> }>;
      schema?: Array<{ connector?: string; name: string; columns: Array<Record<string, unknown>> }>;
      mapper?: Record<string, unknown>;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.configureNode({ uniqueName, parameters, tables, schema, mapper });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/configure",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_connect_nodes",
    description: "Conecta dos nodos del job abierto.",
    inputSchema: z.object({
      source: z.string().describe("Unique name del nodo origen"),
      target: z.string().describe("Unique name del nodo destino"),
      type: z.string().optional().default("FLOW").describe("Tipo de conector"),
      name: z.string().optional().describe("Nombre de la conexion"),
    }),
    handler: async ({ source, target, type, name }: {
      source: string;
      target: string;
      type?: string;
      name?: string;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.connectNodes({ source, target, type, name });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/connect",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_update_node",
    description: "Cambia parametros o etiqueta de un nodo del job abierto. Guarda los cambios.",
    inputSchema: z.object({
      uniqueName: z.string().describe("Unique name del nodo"),
      label: z.string().optional().describe("Nueva etiqueta"),
      parameters: z.record(z.string(), parameterSchema).optional().describe("Parametros a cambiar"),
    }),
    handler: async ({ uniqueName, label, parameters }: {
      uniqueName: string;
      label?: string;
      parameters?: Record<string, { value: string; field?: string; literal?: boolean }>;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.updateNode({ uniqueName, label, parameters });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/update",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_set_schema",
    description: "Define el schema (las columnas) de un nodo del job abierto. Sin schema, la conexion no propaga columnas y el codigo generado sale mal. Los componentes con schema fijo (tFixedFlowInput) necesitan ademas 'values' para sacar filas.",
    inputSchema: z.object({
      uniqueName: z.string().describe("Unique name del nodo"),
      connector: z.string().optional().default("FLOW").describe("Conector al que se cuelga la tabla"),
      columns: z.array(columnSchema).describe("Columnas del schema"),
      values: z.array(z.array(z.string())).optional().describe("Filas de datos, una por registro, con un valor por columna"),
    }),
    handler: async ({ uniqueName, connector, columns, values }: {
      uniqueName: string;
      connector?: string;
      columns: Array<{ name: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean }>;
      values?: string[][];
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.setNodeSchema({ uniqueName, connector, columns, values });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/schema",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_list_nodes",
    description: "Lista los nodos del job abierto en Studio.",
    inputSchema: z.object({
      job: z.string().optional().describe("Job a abrir si no hay ninguno abierto"),
    }),
    handler: async ({ job }: { job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.listNodes({ job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/nodes/list",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_list_components",
    description: "Lista los componentes del catalogo de Talend Studio. Sirve para saber que componentes hay disponibles antes de crear un job.",
    inputSchema: z.object({
      filter: z.string().optional().describe("Texto que tiene que aparecer en el nombre del componente"),
      limit: z.number().optional().describe("Maximo de componentes a devolver"),
    }),
    handler: async ({ filter, limit }: { filter?: string; limit?: number }) => {
      const bridge = await loadBridge();
      const result = await bridge.listComponents({ filter, limit });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/components",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_component_parameters",
    description: "Devuelve los parametros de un componente del catalogo de Talend, con su tipo y su valor por defecto. Es la forma de saber como se configura un componente sin adivinar.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ name }: { name: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.componentParameters({ name });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/components/parameters",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_install_modules",
    description: "Instala los modulos de terceros que Studio echa de menos. Necesario para los componentes cuyo runtime no esta descargado (tMap, tJavaRow, tSortRow, tAggregateRow...). Descarga de internet, asi que hay que pedirlo de forma explicita.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.installModules();
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/workbench/modules/install",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_run_code",
    description: "Compila y ejecuta codigo Java dentro de Talend Studio, con acceso a las APIs del IDE. El codigo debe tener una clase con 'public static Object run()'. Requiere unsafeActions=true en el bridge.",
    inputSchema: z.object({
      code: z.string().describe("Codigo fuente Java con un metodo estatico 'public static Object run()'"),
      className: z.string().optional().describe("Nombre de la clase. Si se omite, se deduce del codigo"),
    }),
    handler: async ({ code, className }: { code: string; className?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.runCode({ code, className });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/run-code",
        data: result.data,
        error: result.error,
      });
    },
  },
];
