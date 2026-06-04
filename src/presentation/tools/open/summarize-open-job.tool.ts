import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../../talend/workspace";
import { findWorkbenchXmiFiles, parseWorkbenchState } from "../../../talend/studio/workbench-xmi";
import { readTextFile } from "../../../talend/files";
import { parseLaunchConfig, parseOpenJobsFromWorkbench } from "../../../talend/open-job";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createSummarizeOpenJobTool() {
  return {
    name: "talend_summarize_open_job",
    description: "Obtiene un resumen detallado del job abierto actualmente en Talend Studio.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre específico del job a resumir (opcional)" },
      },
    },
    handler: wrapHandler(async (input: { jobName?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return fail("NO_PROJECT", "No se detectó TALEND_PROJECT. Configura la variable de entorno.", { startTime: start });
        }

        const ws = resolveWorkspaceFromProject(projectPath);
        const workbenchState = await parseWorkbenchState(projectPath);

        if (!workbenchState.ok || !workbenchState.data) {
          return fail("WORKBENCH_STATE_ERROR", workbenchState.error ?? "No se pudo leer el estado del workbench", { startTime: start });
        }

        const activeEditor = workbenchState.data.activeEditor;
        if (!activeEditor) {
          return ok({ summary: null, message: "No hay un job activo en el workbench" }, { startTime: start });
        }

        const probableJobName = input.jobName ?? activeEditor.probableJobName;
        if (!probableJobName) {
          return ok({ summary: null, message: "No se pudo determinar el nombre del job activo" }, { startTime: start });
        }

        const xmiFiles = await findWorkbenchXmiFiles(ws.workspacePath);
        const launchFiles = xmiFiles.filter((f) => f.includes(".launch"));

        let launchConfig = null;
        for (const launchPath of launchFiles) {
          try {
            const xml = await readTextFile(launchPath, ws.workspacePath);
            const config = parseLaunchConfig(xml, launchPath);
            if (config.jobName === probableJobName) {
              launchConfig = config;
              break;
            }
          } catch {
            // Continuar con el siguiente archivo
          }
        }

        const summary = {
          jobName: probableJobName,
          version: activeEditor.version,
          label: activeEditor.label,
          activeEditor: activeEditor.label,
          probableType: activeEditor.probableType,
          launchConfig,
          workbenchPath: ws.workspacePath,
          metadataPath: ws.metadataPath,
        };

        return ok({ summary }, { startTime: start });
      } catch (err) {
        return fail("SUMMARIZE_OPEN_JOB_ERROR", `Error resumiendo job abierto: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}