/** Tools de jobOperationsTools: catalog. */
import * as z from "zod/v4";

import { bridgeOk, loadBridge } from "../tools-base";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const catalog = [
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
...componentCatalogTools
];
