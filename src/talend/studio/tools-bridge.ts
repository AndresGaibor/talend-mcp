import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "./tools-base";
import { createPlatformContext } from "../../platform";
import { toTalendHostPath } from "../../platform/path-bridge";
import { getJobInspector, type ActiveJobConnection } from "./job-inspector.service";
import { bridgeEventTools } from "./tools-bridge-events";
import { bridgeInspectionTools } from "./tools-bridge-inspection";
import { bridgeLaunchRunTools } from "./tools-bridge-launch-runs";
import { bridgeEditorTools } from "./tools-bridge-editors";

export const bridgeTools = [
  {
    name: "talend_bridge_ping",
    description: "Verifica si el bridge de Talend Studio está disponible.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.ping();
      return bridgeOk(bridgeResultToEnvelope(result, "/ping"));
    },
  },
  {
    name: "talend_bridge_capabilities",
    description: "Obtiene las capacidades del plugin bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.capabilities();
      return bridgeOk(bridgeResultToEnvelope(result, "/capabilities"));
    },
  },
  {
    name: "talend_bridge_audit_environment",
    description: "Audita el entorno de Talend Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.auditEnvironment();
      return bridgeOk(bridgeResultToEnvelope(result, "/audit/environment"));
    },
  },
  {
    name: "talend_bridge_workbench_state",
    description: "Obtiene el estado actual del workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.workbenchState();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/state"));
    },
  },
  {
    name: "talend_bridge_active_job_model",
    description: "Obtiene el modelo del job activo en Studio.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.activeJobModel();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/active-job/model"));
    },
  },
  {
    name: "talend_bridge_commands",
    description: "Lista los comandos disponibles en el bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.commandsList();
      return bridgeOk(bridgeResultToEnvelope(result, "/commands/list"));
    },
  },
  {
    name: "talend_bridge_launch_configs",
    description: "Lista las configuraciones de launch disponibles.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.launchConfigs();
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/configs"));
    },
  },
  {
    name: "talend_bridge_selection",
    description: "Obtiene la selección actual en el workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.selection();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/selection"));
    },
  },
  {
    name: "talend_bridge_views",
    description: "Lista las vistas abiertas en el workbench.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.views();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/views"));
    },
  },
  {
    name: "talend_bridge_open_resource",
    description: "Abre un recurso en el workbench.",
    inputSchema: z.object({
      path: z.string().describe("Ruta del recurso a abrir"),
    }),
    handler: async ({ path }: { path: string }) => {
      const bridge = await loadBridge();
      const ctx = createPlatformContext();
      const studioPath = toTalendHostPath(path, ctx);
      const result = await bridge.openResource(studioPath);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/open-resource"));
    },
  },
  {
    name: "talend_bridge_execute_command",
    description: "Ejecuta un comando en el bridge.",
    inputSchema: z.object({
      commandId: z.string().describe("ID del comando a ejecutar"),
      dryRun: z.boolean().optional().default(true).describe("Si es dry run"),
    }),
    handler: async ({ commandId, dryRun }: { commandId: string; dryRun?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.executeCommand(commandId, dryRun ?? true);
      return bridgeOk(bridgeResultToEnvelope(result, "/commands/execute"));
    },
  },
  {
    name: "talend_bridge_run_launch_config",
    description: "Ejecuta una configuración de launch.",
    inputSchema: z.object({
      name: z.string().describe("Nombre de la launch config"),
      mode: z.string().optional().default("run").describe("Modo de ejecución"),
      dryRun: z.boolean().optional().default(true).describe("Si es dry run"),
    }),
    handler: async ({ name, mode, dryRun }: { name: string; mode?: string; dryRun?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.runLaunchConfig(name, dryRun ?? true, mode);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/run"));
    },
  },
  {
    name: "talend_bridge_workspace_state",
    description: "Obtiene el estado del workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.workspaceState();
      return bridgeOk(bridgeResultToEnvelope(result, "/workspace/state"));
    },
  },
  {
    name: "talend_bridge_problems_markers",
    description: "Obtiene los markers de problemas.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.problemsMarkers();
      return bridgeOk(bridgeResultToEnvelope(result, "/problems/markers"));
    },
  },
  {
    name: "talend_bridge_probe_classes",
    description: "Probe de clases de Talend.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.probeClasses();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/probe/classes"));
    },
  },
  {
    name: "talend_bridge_active_editor_introspect",
    description: "Introspecciona el editor activo.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.activeEditorIntrospect();
      return bridgeOk(bridgeResultToEnvelope(result, "/talend/active-editor/introspect"));
    },
  },
  ...bridgeEventTools,
  {
    name: "talend_bridge_save_active_editor",
    description: "Guarda el editor activo.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.saveActiveEditor();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/save-active"));
    },
  },
  {
    name: "talend_bridge_save_all",
    description: "Guarda todos los editores.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.saveAllEditors();
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/save-all"));
    },
  },
  {
    name: "talend_bridge_refresh_workspace",
    description: "Refresca el workspace.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.refreshWorkspace();
      return bridgeOk(bridgeResultToEnvelope(result, "/workspace/refresh"));
    },
  },
  ...bridgeLaunchRunTools,
  ...bridgeEditorTools,
  ...bridgeInspectionTools,
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
  },
];
