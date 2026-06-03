import { join } from "node:path";
import { existsSync } from "node:fs";
import { listFilesRecursive, readTextFile } from "../files";
import { parseLaunchConfig } from "../open-job";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import type { Evidence } from "../diagnostics/types";

export interface LaunchConfig {
  filePath: string;
  name: string;
  jobName?: string;
  contextName?: string;
  rawAttributes: Record<string, string>;
}

export async function listLaunchConfigs(workspacePath?: string): Promise<Evidence<LaunchConfig[]>> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath && !workspacePath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se pudo detectar proyecto. Configura TALEND_PROJECT.",
    };
  }

  const ws = projectPath ? resolveWorkspaceFromProject(projectPath) : null;
  const metaPath = workspacePath ?? ws?.metadataPath;
  if (!metaPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se pudo determinar ruta de metadata.",
    };
  }

  const launchesDir = join(metaPath, ".plugins", "org.eclipse.debug.core", ".launches");

  if (!existsSync(launchesDir)) {
    return {
      ok: false,
      source: "launch-config",
      confidence: "none",
      error: "No se encontraron launch configs.",
      checkedPaths: [launchesDir],
    };
  }

  try {
    const launchFiles = await listFilesRecursive(launchesDir, (ruta) => ruta.endsWith(".launch"));
    if (launchFiles.length === 0) {
      return {
        ok: false,
        source: "launch-config",
        confidence: "none",
        error: "No se encontraron archivos .launch.",
        checkedPaths: [launchesDir],
      };
    }

    const configs: LaunchConfig[] = [];
    for (const filePath of launchFiles) {
      try {
        const xml = await readTextFile(filePath, metaPath);
        const parsed = parseLaunchConfig(xml, filePath);
        configs.push({
          filePath,
          name: parsed.jobName ?? basename(filePath).replace(/\.launch$/, ""),
          jobName: parsed.jobName,
          contextName: extractContextFromLaunch(xml),
          rawAttributes: extractAllAttributes(xml),
        });
      } catch (err) {
        configs.push({
          filePath,
          name: basename(filePath).replace(/\.launch$/, ""),
          rawAttributes: {},
        });
      }
    }

    return {
      ok: true,
      source: "launch-config",
      confidence: "medium",
      data: configs,
      checkedPaths: [launchesDir],
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error listando launch configs: ${err instanceof Error ? err.message : String(err)}`,
      checkedPaths: [launchesDir],
    };
  }
}

function basename(path: string): string {
  return path.split("/").pop() ?? path.split("\\").pop() ?? path;
}

function extractContextFromLaunch(xml: string): string | undefined {
  const match = xml.match(/TALEND_CONTEXT[^"]*"([^"]+)"/);
  return match?.[1] ?? undefined;
}

function extractAllAttributes(xml: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /stringAttribute\s+key="([^"]+)"\s+value="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    attrs[m[1]!] = m[2] ?? "";
  }
  return attrs;
}
