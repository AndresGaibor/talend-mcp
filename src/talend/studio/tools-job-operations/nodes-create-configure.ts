/** Tools de jobOperationsTools: nodes-create-configure. */
import * as z from "zod/v4";

import { bridgeOk, loadBridge } from "../tools-base";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const nodesCreateConfigure = [
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
  }
];
