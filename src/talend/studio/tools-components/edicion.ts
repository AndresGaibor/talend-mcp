import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";
import { resolveProjectPath } from "../../workspace";
import { ComponentEditService } from "../component-edit.service";

// Edición directa de propiedades de un componente.
export const componentLabelTools = [
  {
    name: "talend_components_rename_label",
    description: "Cambia el label (nombre visible) de un componente Talend de forma segura.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      newLabel: z.string().describe("Nuevo LABEL visible"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, newLabel }: { jobName: string; folderPath?: string; uniqueName: string; newLabel: string }) => {
      const projectPath = await resolveProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-label",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }

      const editService = new ComponentEditService();
      const result = await editService.renameLabel(jobName, uniqueName, newLabel, folderPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-label",
        data: { jobName, uniqueName, newLabel, snapshotId: result.snapshotId },
      });
    }
  },
];

export const componentPositionTools = [
  {
    name: "talend_components_update_position",
    description: "Actualiza la posición posX y posY de un componente Talend.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      posX: z.number().describe("Nueva posición X"),
      posY: z.number().describe("Nueva posición Y"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, posX, posY }: { jobName: string; folderPath?: string; uniqueName: string; posX: number; posY: number }) => {
      const projectPath = await resolveProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/update-position",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }

      const editService = new ComponentEditService();
      const result = await editService.updatePosition(jobName, uniqueName, posX, posY, folderPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/update-position",
        data: { ok: true, uniqueName, posX, posY, snapshotId: result.snapshotId },
      });
    }
  },
];
