import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../../talend/workspace";
import { findWorkbenchXmiFiles, parseWorkbenchState } from "../../../talend/studio/workbench-xmi";
import { readTextFile } from "../../../talend/files";
import { parseOpenJobsFromWorkbench } from "../../../talend/open-job";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

export function createDetectOpenJobsTool() {
  return {
    name: "talend_detect_open_jobs",
    description: "Detecta los jobs abiertos en Talend Studio desde los archivos workbench XMI.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: wrapHandler(async () => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return fail("NO_PROJECT", "No se detectó TALEND_PROJECT. Configura la variable de entorno.", { startTime: start });
        }

        const ws = resolveWorkspaceFromProject(projectPath);
        const xmiFiles = await findWorkbenchXmiFiles(ws.workspacePath);

        if (xmiFiles.length === 0) {
          return ok({ jobs: [], count: 0, message: "No se encontraron archivos workbench XMI" }, { startTime: start });
        }

        const allJobs: Array<{ jobName: string; version: string; label: string; workbenchPath: string }> = [];

        for (const xmiPath of xmiFiles) {
          try {
            const xml = await readTextFile(xmiPath, ws.workspacePath);
            const jobs = parseOpenJobsFromWorkbench(xml, xmiPath);
            allJobs.push(...jobs);
          } catch {
            // Ignorar archivos problemáticos
          }
        }

        return ok({ jobs: allJobs, count: allJobs.length }, { startTime: start });
      } catch (err) {
        return fail("DETECT_OPEN_JOBS_ERROR", `Error detectando jobs abiertos: ${err instanceof Error ? err.message : String(err)}`, { startTime: start });
      }
    }),
  };
}