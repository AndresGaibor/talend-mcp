import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";
import { resolveProjectPath } from "../../workspace";
import { findTalendJob } from "../../job-crud";
import { readTextFile } from "../../files";
import { parseJobItem } from "../../job-parser";
import { ComponentEditService } from "../component-edit.service";

// Renombrado de UNIQUE_NAME con previsualización y aplicación confirmada.
export const componentRenameTools = [
  {
    name: "talend_components_rename_unique_name_preview",
    description: "Genera la previsualización del cambio en cascada de UNIQUE_NAME.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      oldUniqueName: z.string().describe("UNIQUE_NAME actual"),
      newUniqueName: z.string().describe("UNIQUE_NAME propuesto"),
    }),
    handler: async ({ jobName, folderPath, oldUniqueName, newUniqueName }: { jobName: string; folderPath?: string; oldUniqueName: string; newUniqueName: string }) => {
      const projectPath = await resolveProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-unique-name-preview",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);

      const parsed = parseJobItem(xml, job.itemPath);
      const alreadyExists = parsed.components.some(c => c.uniqueName === newUniqueName);
      if (alreadyExists) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/rename-unique-name-preview",
          error: { code: "ALREADY_EXISTS", message: `El nombre '${newUniqueName}' ya existe en este job.` }
        });
      }

      // Find connections affected
      const affectedConns = parsed.connections.filter(c => c.source === oldUniqueName || c.target === oldUniqueName);

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-unique-name-preview",
        data: {
          ok: true,
          oldUniqueName,
          newUniqueName,
          affectedConnectionsCount: affectedConns.length,
          confirmationToken: `rename_${oldUniqueName}_to_${newUniqueName}`,
          warning: "Esta operación es crítica y actualizará flujos y mapeos en cascada."
        }
      });
    }
  },
  {
    name: "talend_components_rename_unique_name_apply",
    description: "Aplica el cambio en cascada de UNIQUE_NAME usando un token de confirmación.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      oldUniqueName: z.string().describe("UNIQUE_NAME actual"),
      newUniqueName: z.string().describe("UNIQUE_NAME propuesto"),
      confirmationToken: z.string().describe("Token de confirmación"),
    }),
    handler: async ({ jobName, folderPath, oldUniqueName, newUniqueName, confirmationToken }: { jobName: string; folderPath?: string; oldUniqueName: string; newUniqueName: string; confirmationToken: string }) => {
      const expectedToken = `rename_${oldUniqueName}_to_${newUniqueName}`;
      if (confirmationToken !== expectedToken) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/rename-unique-name-apply",
          error: { code: "INVALID_TOKEN", message: "Token de confirmación inválido." }
        });
      }

      const projectPath = await resolveProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-unique-name-apply",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }

      const editService = new ComponentEditService();
      const result = await editService.renameUniqueName(jobName, oldUniqueName, newUniqueName, folderPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-unique-name-apply",
        data: { ok: true, oldUniqueName, newUniqueName, snapshotId: result.snapshotId },
      });
    }
  },
];
