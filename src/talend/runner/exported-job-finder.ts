import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { Evidence } from "../diagnostics/types";

export interface ExportedJobScript {
  jobName: string;
  scriptPath: string;
  platform: "windows" | "posix";
  detectedVersion?: string;
  folderPath: string;
  modifiedAt: string;
}

function getBuildsDir(): string | undefined {
  return process.env.TALEND_BUILDS_DIR;
}

async function findScriptsRecursive(
  dir: string,
  jobName?: string,
): Promise<ExportedJobScript[]> {
  const results: ExportedJobScript[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findScriptsRecursive(fullPath, jobName)));
      continue;
    }
    if (!entry.isFile()) continue;

    const isSh = entry.name.endsWith("_run.sh");
    const isBat = entry.name.endsWith("_run.bat");

    if (!isSh && !isBat) continue;

    const scriptJobName = entry.name.replace(/_run\.(sh|bat)$/, "");

    if (jobName && scriptJobName !== jobName) continue;

    const platform = isBat ? "windows" : "posix";
    try {
      const fileStat = await stat(fullPath);
      results.push({
        jobName: scriptJobName,
        scriptPath: fullPath,
        platform,
        folderPath: dir,
        modifiedAt: fileStat.mtime.toISOString(),
      });
    } catch {
      results.push({
        jobName: scriptJobName,
        scriptPath: fullPath,
        platform,
        folderPath: dir,
        modifiedAt: "",
      });
    }
  }

  return results;
}

export async function findExportedJobScripts(options: {
  buildsDir?: string;
  jobName?: string;
}): Promise<Evidence<ExportedJobScript[]>> {
  const buildsDir = options.buildsDir ?? getBuildsDir();

  if (!buildsDir) {
    return {
      ok: false,
      source: "exported-job-script",
      confidence: "none",
      error:
        "No se encontró TALEND_BUILDS_DIR. Configura la variable de entorno TALEND_BUILDS_DIR apuntando al directorio donde se exportan los jobs compilados.",
      checkedPaths: [],
    };
  }

  if (!existsSync(buildsDir)) {
    return {
      ok: false,
      source: "exported-job-script",
      confidence: "none",
      error: `TALEND_BUILDS_DIR no existe: ${buildsDir}`,
      checkedPaths: [buildsDir],
    };
  }

  try {
    const scripts = await findScriptsRecursive(buildsDir, options.jobName);

    if (scripts.length === 0) {
      const message = options.jobName
        ? `No se encontraron scripts exportados para '${options.jobName}' en ${buildsDir}`
        : `No se encontraron scripts exportados (*_run.sh, *_run.bat) en ${buildsDir}`;
      return {
        ok: false,
        source: "exported-job-script",
        confidence: "none",
        error: message,
        checkedPaths: [buildsDir],
      };
    }

    return {
      ok: true,
      source: "exported-job-script",
      confidence: "high",
      data: scripts,
      checkedPaths: [buildsDir],
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error buscando scripts exportados: ${err instanceof Error ? err.message : String(err)}`,
      checkedPaths: [buildsDir],
    };
  }
}
