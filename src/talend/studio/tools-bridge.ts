import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge, bridgeResultToEnvelope } from "./tools-base";

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
      const result = await bridge.openResource(path);
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
  {
    name: "talend_bridge_events_recent",
    description: "Obtiene eventos recientes del bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.eventsRecent();
      return bridgeOk(bridgeResultToEnvelope(result, "/events/recent"));
    },
  },
  {
    name: "talend_bridge_events_clear",
    description: "Limpia los eventos del bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.eventsClear();
      return bridgeOk(bridgeResultToEnvelope(result, "/events/clear"));
    },
  },
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
  {
    name: "talend_bridge_launch_runs",
    description: "Lista las ejecuciones recientes.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.launchRuns();
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/runs"));
    },
  },
  {
    name: "talend_bridge_launch_status",
    description: "Obtiene el estado de una ejecución.",
    inputSchema: z.object({
      launchId: z.string().describe("ID de la launch"),
    }),
    handler: async ({ launchId }: { launchId: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.launchRunStatus(launchId);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/run-status"));
    },
  },
  {
    name: "talend_bridge_launch_wait",
    description: "Espera a que una ejecución termine.",
    inputSchema: z.object({
      launchId: z.string().describe("ID de la launch"),
      timeoutMs: z.number().optional().default(60000).describe("Timeout en ms"),
    }),
    handler: async ({ launchId, timeoutMs }: { launchId: string; timeoutMs?: number }) => {
      const bridge = await loadBridge();
      const result = await bridge.launchWait(launchId, timeoutMs);
      return bridgeOk(bridgeResultToEnvelope(result, "/launch/wait"));
    },
  },
  {
    name: "talend_bridge_find_editor",
    description: "Busca editores abiertos en el workbench.",
    inputSchema: z.object({
      titleContains: z.string().describe("Texto que contiene el título del editor"),
    }),
    handler: async ({ titleContains }: { titleContains: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.findEditor(titleContains);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/find-editor"));
    },
  },
  {
    name: "talend_bridge_activate_editor",
    description: "Activa un editor por su título.",
    inputSchema: z.object({
      title: z.string().describe("Título exacto del editor"),
    }),
    handler: async ({ title }: { title: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.activateEditor(title);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/activate-editor"));
    },
  },
  {
    name: "talend_bridge_close_editor",
    description: "Cierra un editor abierto.",
    inputSchema: z.object({
      title: z.string().describe("Título del editor"),
      save: z.boolean().optional().default(true).describe("Si debe guardar antes de cerrar"),
    }),
    handler: async ({ title, save }: { title: string; save?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.closeEditor(title, save ?? true);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/close-editor"));
    },
  },
  {
    name: "talend_bridge_show_view",
    description: "Muestra una vista específica en el workbench.",
    inputSchema: z.object({
      viewId: z.string().describe("ID de la vista (ej: org.eclipse.ui.views.ProblemView)"),
    }),
    handler: async ({ viewId }: { viewId: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.showView(viewId);
      return bridgeOk(bridgeResultToEnvelope(result, "/workbench/show-view"));
    },
  },
];