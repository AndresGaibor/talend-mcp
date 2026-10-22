import * as z from "zod/v4";
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
