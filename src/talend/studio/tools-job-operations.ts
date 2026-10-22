import * as z from "zod/v4";
import { bridgeOk, loadBridge } from "./tools-base";
import { columnSchema, componentSpecShape, parameterSchema } from "./tools-job-operation-schemas";
import { jobContextTools } from "./tools-job-contexts";
import { studioMaintenanceTools } from "./tools-studio-maintenance";
import { jobDiagnosticsTools } from "./tools-job-diagnostics";
import { componentCatalogTools } from "./tools-component-catalog";
import { nodeConnectionTools } from "./tools-node-connection";

/**
 * Tools para operar sobre el job abierto en Talend Studio.
 *
 * Usan la API del propio IDE, no escriben el XML a mano. Cada componente nace
 * con los parametros y valores por defecto que pone Talend, y el formato lo
 * escribe Studio.
 */

export const jobOperationsTools = [
  {
    name: "talend_job_create_in_studio",
    description:
      "Crea un job vacio en el repositorio de Talend y lo abre en el editor. El job se crea con la API del IDE, no escribiendo el XML a mano. Con jobType se elige el tipo de job (Standard, Big_Data_Batch para Spark Batch, Big_Data_Stream para Spark Streaming), que decide que paleta de componentes usa el editor.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job. Solo letras, digitos y guion bajo"),
      version: z.string().optional().default("0.1").describe("Version del job"),
      folder: z.string().optional().default("").describe("Carpeta dentro de process/"),
      description: z.string().optional().describe("Descripcion del job"),
      replace: z.boolean().optional().default(false).describe("Reemplaza el job si ya existe con esa etiqueta"),
      jobType: z
        .string()
        .optional()
        .describe("Tipo de job: Standard (por defecto), Big_Data_Batch (Spark Batch), Big_Data_Stream (Spark Streaming)"),
      framework: z.string().optional().describe("Framework del job: Spark, Storm, MapReduce"),
    }),
    handler: async ({ name, version, folder, description, replace, jobType, framework }: {
      name: string;
      version?: string;
      folder?: string;
      description?: string;
      replace?: boolean;
      jobType?: string;
      framework?: string;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.createJob({ name, version, folder, description, replace, jobType, framework });
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
  ...nodeConnectionTools,
  ...jobContextTools,
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
  ...studioMaintenanceTools,
  ...jobDiagnosticsTools,
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
  ...componentCatalogTools,
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
