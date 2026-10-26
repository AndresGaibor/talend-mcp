import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";
import { PatchPreviewService } from "../patch-preview.service";

// Previsualización y aplicación de parches de parámetros.
export const componentPatchTools = [
  {
    name: "talend_components_preview_patch",
    description: "Muestra la previsualización (diff) de aplicar un parche de parámetros a un componente.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      patch: z.record(z.string(), z.string()).describe("Patch de parámetros (clave-valor)"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, patch }: { jobName: string; folderPath?: string; uniqueName: string; patch: Record<string, string> }) => {
      const previewService = new PatchPreviewService();
      const result = await previewService.previewPatch(jobName, uniqueName, patch, folderPath);

      let riskLevel: "low" | "medium" | "high" = "low";
      const warnings: string[] = [];
      const dangerousParams = ["UNIQUE_NAME", "SCHEMA", "DBNAME", "HOST", "PORT"];
      for (const k of Object.keys(patch)) {
        if (dangerousParams.includes(k)) {
          riskLevel = "high";
          warnings.push(`El parámetro '${k}' es crítico y requiere confirmación adicional.`);
        }
      }

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/preview-patch",
        data: {
          ok: true,
          componentBefore: result.current,
          componentAfter: result.proposed,
          diff: result.diff.join("\n"),
          warnings,
          riskLevel,
        },
      });
    }
  },
  {
    name: "talend_components_apply_patch",
    description: "Aplica un parche de parámetros a un componente Talend. Requiere confirmationToken si el preview indica alto riesgo.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      patch: z.record(z.string(), z.string()).describe("Patch de parámetros (clave-valor)"),
      confirmationToken: z.string().optional().describe("Token de confirmación (requerido si riskLevel es high)"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, patch, confirmationToken }: { jobName: string; folderPath?: string; uniqueName: string; patch: Record<string, string>; confirmationToken?: string }) => {
      const previewService = new PatchPreviewService();
      const result = await previewService.applyPatch(jobName, uniqueName, patch, confirmationToken, folderPath);

      if (result.requiresConfirmation) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/apply-patch",
          error: { code: "CONFIRMATION_REQUIRED", message: "Se requiere token de confirmación", details: { diff: result.diff } }
        });
      }

      if (!result.success) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/apply-patch",
          error: { code: "APPLY_FAILED", message: result.error ?? "Error desconocido" }
        });
      }

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/apply-patch",
        data: { ok: true, jobName, uniqueName, patch, snapshotId: result.snapshotId },
      });
    }
  },
];
