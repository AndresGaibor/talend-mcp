import { join } from "node:path";
import { existsSync } from "node:fs";
import { listFilesRecursive, readTextFile } from "../files";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import type { Evidence, Confidence } from "../diagnostics/types";

export interface WorkbenchEditor {
  label: string;
  rawLine?: string;
  probableType: "job" | "context" | "analysis" | "unknown";
  probableJobName?: string;
  version?: string;
}

export interface WorkbenchView {
  label: string;
  id?: string;
}

export interface WorkbenchState {
  files: string[];
  openEditors: WorkbenchEditor[];
  visibleViews: WorkbenchView[];
  activeEditor?: WorkbenchEditor;
  warnings: string[];
}

export async function findWorkbenchXmiFiles(workspacePath: string): Promise<string[]> {
  const workbenchDir = join(workspacePath, ".metadata", ".plugins", "org.eclipse.e4.workbench");
  if (!existsSync(workbenchDir)) return [];
  try {
    return await listFilesRecursive(workbenchDir, (ruta) => ruta.endsWith(".xmi"));
  } catch {
    return [];
  }
}

export async function parseWorkbenchState(
  projectPath?: string,
): Promise<Evidence<WorkbenchState>> {
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se pudo detectar proyecto Talend.",
    };
  }

  const ws = resolveWorkspaceFromProject(projectPath);
  const xmiFiles = await findWorkbenchXmiFiles(ws.workspacePath);

  if (xmiFiles.length === 0) {
    const workbenchDir = join(ws.metadataPath, ".plugins", "org.eclipse.e4.workbench");
    return {
      ok: false,
      source: "filesystem",
      confidence: "none",
      error: "No se encontraron archivos .xmi en el workbench.",
      checkedPaths: [workbenchDir],
    };
  }

  const editors: WorkbenchEditor[] = [];
  const views: WorkbenchView[] = [];
  const warnings: string[] = [];

  for (const xmiPath of xmiFiles) {
    try {
      const xml = await readTextFile(xmiPath, ws.workspacePath);
      parseXmiContent(xml, xmiPath, editors, views, warnings);
    } catch (err) {
      warnings.push(`Error leyendo ${xmiPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const activeEditor = editors.find((e) => e.probableType === "job") ?? editors[0] as WorkbenchEditor | undefined;

  return {
    ok: editors.length > 0,
    source: "workbench-xmi",
    confidence: editors.length > 0 ? "medium" : "none",
    data: {
      files: xmiFiles,
      openEditors: editors,
      visibleViews: views,
      activeEditor,
      warnings,
    },
  };
}

function parseXmiContent(
  xml: string,
  xmiPath: string,
  editors: WorkbenchEditor[],
  views: WorkbenchView[],
  warnings: string[],
): void {
  const labelRegex = /label="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = labelRegex.exec(xml)) !== null) {
    const label = match[1] ?? "";

    if (label.startsWith("Job ")) {
      const jobMatch = /^Job\s+(.+)\s+(\d+(?:\.\d+)*)$/.exec(label);
      if (jobMatch) {
        editors.push({
          label,
          rawLine: match[0],
          probableType: "job",
          probableJobName: jobMatch[1] ?? undefined,
          version: jobMatch[2] ?? undefined,
        });
      } else {
        editors.push({ label, probableType: "job" });
      }
    } else if (label.startsWith("Context ")) {
      editors.push({ label, probableType: "context" });
    } else if (label.endsWith(".ana")) {
      editors.push({ label, probableType: "analysis" });
    }
  }

  const viewRegex = /<views[^>]*>.*?<\/views>/gs;
  const viewMatch = viewRegex.exec(xml);
  if (viewMatch) {
    const viewLabelRegex = /label="([^"]+)"/g;
    let vMatch: RegExpExecArray | null;
    while ((vMatch = viewLabelRegex.exec(viewMatch[0])) !== null) {
      views.push({ label: vMatch[1] ?? "" });
    }
  }
}

export async function getProbableActiveJob(): Promise<{
  ok: boolean;
  source: string;
  confidence: Confidence;
  jobName?: string;
  error?: string;
  nextSteps?: string[];
}> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se detectó TALEND_PROJECT.",
    };
  }

  const xmiResult = await parseWorkbenchState(projectPath);
  if (xmiResult.ok && xmiResult.data?.activeEditor?.probableJobName) {
    return {
      ok: true,
      source: "workbench-xmi",
      confidence: "medium",
      jobName: xmiResult.data.activeEditor.probableJobName,
    };
  }

  return {
    ok: false,
    source: "workbench-xmi",
    confidence: "none",
    error: "No se pudo determinar el job activo desde el workbench XMI.",
    nextSteps: [
      "Verifica que Talend Studio tenga un job abierto.",
      "Usa talend_list_open_editors para ver los editores detectados.",
      "Si el bridge de Studio está disponible, tendrá mayor precisión.",
    ],
  };
}
