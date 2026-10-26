import * as z from "zod/v4";
import { planificarCierre, type EditorAbierto } from "./editores-guardados";
import { bridgeOk, bridgeResultToEnvelope, loadBridge } from "./tools-base";

export const bridgeEditorTools = [
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
    name: "talend_bridge_close_saved_editors",
    description:
      "Cierra los editores de jobs que no tienen cambios sin guardar, para liberar memoria del heap de Studio. Con `prefix` solo cierra los jobs cuyo nombre empieza por ese texto (por ejemplo MCP_L5_, los del arnes). Por defecto solo lista lo que cerraria: con `dryRun: false` lo cierra. No guarda ni descarta nada: un editor con cambios sin guardar se deja abierto.",
    inputSchema: z.object({
      prefix: z.string().optional().describe("Solo jobs cuyo nombre empieza por este texto"),
      dryRun: z.boolean().optional().default(true).describe("Por defecto solo lista lo que cerraria; false cierra los editores"),
    }),
    handler: async ({ prefix, dryRun }: { prefix?: string; dryRun?: boolean }) => {
      const bridge = await loadBridge();
      const estado = await bridge.workbenchState();
      if (!estado.ok) {
        return bridgeOk(bridgeResultToEnvelope(estado, "/workbench/state"));
      }
      const editores = (estado.data?.windows ?? []).flatMap(
        (ventana) => (ventana.openEditors ?? []) as EditorAbierto[],
      );
      const plan = planificarCierre(editores, prefix);
      const simular = dryRun ?? true;
      const cerrados: string[] = [];
      const fallidos: string[] = [];
      if (!simular) {
        for (const title of plan.cerrar) {
          const cierre = await bridge.closeEditor(title, false);
          if (cierre.ok && cierre.data?.closed === true) cerrados.push(title);
          else fallidos.push(title);
        }
      }
      return bridgeOk({
        ok: fallidos.length === 0,
        source: estado.source,
        confidence: estado.confidence,
        endpoint: "/workbench/close-editor",
        data: { dryRun: simular, cerrar: plan.cerrar, cerrados, fallidos, conservar: plan.conservar },
      });
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
