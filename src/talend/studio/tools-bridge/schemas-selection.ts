/** Tools de bridgeTools: schemas-selection. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "../tools-base";

import { createPlatformContext } from "../../../platform";

import { toTalendHostPath } from "../../../platform/path-bridge";

import { getJobInspector, type ActiveJobConnection } from "../job-inspector.service";

import { bridgeEventTools } from "../tools-bridge-events";

import { bridgeInspectionTools } from "../tools-bridge-inspection";


import { bridgeEditorTools } from "../tools-bridge-editors";
export const schemasSelection = [
{
    name: "talend_bridge_get_selected_components_schemas",
    description:
      "Obtiene los schemas de entrada y salida de los componentes indicados en Talend Studio. Si no se indican, se infieren del job activo.",
    inputSchema: z.object({
      uniqueNames: z
        .array(z.string())
        .optional()
        .describe("UNIQUE_NAME de los componentes. Si se omite, se usa el componente de entrada y el de salida del job activo."),
    }),
    handler: async ({ uniqueNames }: { uniqueNames?: string[] }) => {
      try {
        const inspector = getJobInspector();
        const requested = uniqueNames?.filter((name) => name.trim().length > 0) ?? [];

        let targets = requested;
        let inferredFrom: string | undefined;

        if (targets.length === 0) {
          const details = await inspector.getActiveJobDetails();
          const sources = new Set(details.connections.map((conn) => conn.from));
          const sinks = new Set(details.connections.map((conn) => conn.to));

          const inputComponent = details.components.find(
            (comp) => !sources.has(comp.uniqueName) && !sinks.has(comp.uniqueName),
          );
          const outputComponent = details.components.find(
            (comp) => !sinks.has(comp.uniqueName) && sources.has(comp.uniqueName),
          );

          targets = [inputComponent?.uniqueName, outputComponent?.uniqueName].filter(
            (name): name is string => Boolean(name),
          );
          inferredFrom = details.jobName;
        }

        if (targets.length === 0) {
          return bridgeFail({
            ok: false,
            source: "studio-bridge",
            confidence: "low",
            endpoint: "/talend/active-component/schemas",
            error: {
              code: "NO_COMPONENTS_SELECTED",
              message: "No se pudieron determinar los componentes de entrada y salida del job activo.",
            },
          });
        }

        const components: Array<{
          uniqueName: string;
          componentName?: string;
          schemas: unknown;
        }> = [];

        for (const uniqueName of targets) {
          const schemas = await inspector.getComponentSchemas(uniqueName);
          components.push({ uniqueName, schemas: schemas ?? [] });
        }

        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-component/schemas",
          data: {
            inferredFrom,
            inputSchema: components[0]?.schemas ?? null,
            outputSchema: components[1]?.schemas ?? null,
            components,
          },
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-component/schemas",
          error: {
            code: "COMPONENT_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener los schemas seleccionados",
          },
        });
      }
    },
  },
{
    name: "talend_bridge_select_component",
    description: "Selecciona y revela un componente en el editor activo de Talend Studio.",    inputSchema: z.object({
      uniqueName: z.string().describe("UNIQUE_NAME del componente a seleccionar"),
    }),
    handler: async ({ uniqueName }: { uniqueName: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.selectComponent(uniqueName);
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/active-job/select-component"));
    },
  }
];
