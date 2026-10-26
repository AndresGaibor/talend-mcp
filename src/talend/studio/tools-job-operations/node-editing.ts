/** Tools de jobOperationsTools: node-editing. */
import * as z from "zod/v4";

import { bridgeOk, loadBridge } from "../tools-base";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const nodeEditing = [
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
  }
];
