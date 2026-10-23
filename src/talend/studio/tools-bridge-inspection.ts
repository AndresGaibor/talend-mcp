import * as z from "zod/v4";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import { getJobInspector } from "./job-inspector.service";

export const bridgeInspectionTools = [
  {
    name: "talend_bridge_active_job_dependencies",
    description:
      "Lista rutinas, módulos y bibliotecas que Talend declara para el job activo. Omite rutas locales y credenciales.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const bridge = await loadBridge();
        const result = await bridge.activeJobDependencies();
        return bridgeOk({
          ok: result.ok,
          source: result.source,
          confidence: result.confidence,
          endpoint: "/talend/active-job/dependencies",
          data: result.data,
          error: result.error,
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-job/dependencies",
          error: {
            code: "JOB_DEPENDENCIES_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener dependencias del job",
          },
        });
      }
    },
  },
  {
    name: "talend_bridge_active_job_details",
    description: "Obtiene los detalles profundos del job activo en Talend Studio (componentes con posiciones, conexiones).",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inspector = getJobInspector();
        const details = await inspector.getActiveJobDetails();
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-job/details",
          data: details,
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-job/details",
          error: {
            code: "JOB_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener job details",
          },
        });
      }
    },
  },
  {
    name: "talend_bridge_active_component_details",
    description: "Obtiene los detalles completos de un componente del job activo en Talend Studio (parámetros, schemas, conexiones).",
    inputSchema: z.object({
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      includeRaw: z.boolean().optional().describe("Incluir metadatos raw"),
    }),
    handler: async ({ uniqueName, includeRaw }: { uniqueName: string; includeRaw?: boolean }) => {
      try {
        const inspector = getJobInspector();
        const details = await inspector.getComponentDetails(uniqueName, includeRaw);
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-component/details",
          data: { component: details },
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-component/details",
          error: {
            code: "COMPONENT_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener component details",
          },
        });
      }
    },
  },
  {
    name: "talend_bridge_active_component_parameters",
    description: "Obtiene todos los parámetros de configuración de un componente activo.",
    inputSchema: z.object({ uniqueName: z.string().describe("UNIQUE_NAME del componente") }),
    handler: async ({ uniqueName }: { uniqueName: string }) => {
      try {
        const inspector = getJobInspector();
        const parameters = await inspector.getComponentParameters(uniqueName);
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-component/parameters",
          data: { parameters },
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-component/parameters",
          error: {
            code: "COMPONENT_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener parámetros",
          },
        });
      }
    },
  },
  {
    name: "talend_bridge_active_component_schemas",
    description: "Obtiene los schemas y columnas de un componente activo.",
    inputSchema: z.object({ uniqueName: z.string().describe("UNIQUE_NAME del componente") }),
    handler: async ({ uniqueName }: { uniqueName: string }) => {
      try {
        const inspector = getJobInspector();
        const schemas = await inspector.getComponentSchemas(uniqueName);
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-component/schemas",
          data: { schemas },
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-component/schemas",
          error: {
            code: "COMPONENT_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener schemas",
          },
        });
      }
    },
  },
  {
    name: "talend_bridge_active_component_connections",
    description: "Obtiene las conexiones entrantes y salientes de un componente activo.",
    inputSchema: z.object({ uniqueName: z.string().describe("UNIQUE_NAME del componente") }),
    handler: async ({ uniqueName }: { uniqueName: string }) => {
      try {
        const inspector = getJobInspector();
        const connections = await inspector.getComponentConnections(uniqueName);
        return bridgeOk({
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/talend/active-component/connections",
          data: {
            incomingConnections: connections.incoming,
            outgoingConnections: connections.outgoing,
          },
        });
      } catch (error) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/talend/active-component/connections",
          error: {
            code: "COMPONENT_INSPECTOR_ERROR",
            message: error instanceof Error ? error.message : "Error al obtener conexiones",
          },
        });
      }
    },
  },
];
