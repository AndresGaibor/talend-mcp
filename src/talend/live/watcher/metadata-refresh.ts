import { join } from "node:path";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../../workspace";
import { readTextFile } from "../../files";
import { parseWorkbenchState } from "../../studio/workbench-xmi";
import { updateLiveTalendState } from "../state";

/**
 * Refresca el estado vivo a partir de los metadatos de Studio.
 *
 * El editor activo se deduce del workbench `.xmi`; el ultimo error, de las
 * lineas con ERROR o Exception del `.log` del workspace.
 */
export async function refreshStateFromMetadata(filename: string): Promise<void> {
  if (filename.endsWith(".xmi")) {
    const projectPath = getConfiguredProjectPath();
    if (projectPath) {
      const xmiResult = await parseWorkbenchState(projectPath);
      if (xmiResult.ok && xmiResult.data?.activeEditor?.probableJobName) {
        updateLiveTalendState({
          probableOpenJob: {
            jobName: xmiResult.data.activeEditor.probableJobName,
            source: "workbench-xmi",
            confidence: "medium",
            detectedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  if (filename === ".log") {
    const projectPath = getConfiguredProjectPath();
    if (projectPath) {
      const ws = resolveWorkspaceFromProject(projectPath);
      const logPath = join(ws.metadataPath, ".log");
      try {
        const content = await readTextFile(logPath, ws.workspacePath);
        const errorLines = content
          .split("\n")
          .filter((l: string) => l.includes("ERROR") || l.includes("Exception"));
        if (errorLines.length > 0) {
          const lastError = errorLines[errorLines.length - 1] ?? "";
          updateLiveTalendState({
            lastStudioError: {
              message: lastError.substring(0, 500),
              source: "metadata-log",
              detectedAt: new Date().toISOString(),
              snippet: lastError.substring(0, 200),
            },
          });
        }
      } catch {
        // ignore log read errors
      }
    }
  }
}
