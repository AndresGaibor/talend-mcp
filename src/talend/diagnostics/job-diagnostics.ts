import { join } from "node:path";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import { parseWorkbenchState, getProbableActiveJob } from "../studio/workbench-xmi";
import { listJobs } from "../repository";
import { readTextFile } from "../files";
import { parseJobItem } from "../job-parser";
import { parseLatestRunLog } from "../run-logs";
import type { Evidence } from "./types";

export interface JobDiagnosticReport {
  jobName: string;
  itemPath: string;
  propertiesPath: string;
  components: {
    total: number;
    byType: Record<string, number>;
    missingUniqueNames: string[];
  };
  connections: {
    total: number;
    danglingConnections: Array<{
      uniqueName?: string;
      source?: string;
      target?: string;
      reason: string;
    }>;
  };
  contexts: {
    total: number;
    names: string[];
    possibleMissingValues: string[];
  };
  schemas: {
    total: number;
    warnings: string[];
  };
  logs: {
    latestStatus?: "success" | "error" | "unknown";
    latestError?: string;
  };
  warnings: string[];
}

export async function diagnoseJob(
  jobName?: string,
): Promise<Evidence<JobDiagnosticReport>> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: "No se detectó TALEND_PROJECT.",
    };
  }

  let resolvedJobName = jobName;

  if (!resolvedJobName) {
    const activeJob = await getProbableActiveJob();
    if (activeJob.ok && activeJob.jobName) {
      resolvedJobName = activeJob.jobName;
    } else {
      return {
        ok: false,
        source: "workbench-xmi",
        confidence: "none",
        error: "No se especificó jobName y no se pudo detectar job activo. Proporciona jobName explícitamente.",
        nextSteps: [
          "Usa talend_list_jobs para ver los jobs disponibles.",
          "Usa talend_list_open_editors para ver si hay jobs abiertos.",
        ],
      };
    }
  }

  const jobs = await listJobs(projectPath);
  const target = jobs.find((j) => j.label === resolvedJobName);
  if (!target) {
    return {
      ok: false,
      source: "filesystem",
      confidence: "none",
      error: `Job '${resolvedJobName}' no encontrado.`,
    };
  }

  try {
    const xml = await readTextFile(target.itemPath, projectPath);
    const job = parseJobItem(xml, target.itemPath);

    const byType: Record<string, number> = {};
    const missingUniqueNames: string[] = [];
    for (const comp of job.components) {
      byType[comp.componentName] = (byType[comp.componentName] ?? 0) + 1;
      if (!comp.uniqueName || comp.uniqueName.trim() === "") {
        missingUniqueNames.push(comp.componentName);
      }
    }

    const componentNames = new Set(job.components.map((c) => c.uniqueName));
    const danglingConnections: JobDiagnosticReport["connections"]["danglingConnections"] = [];
    for (const conn of job.connections) {
      if (conn.source && !componentNames.has(conn.source)) {
        danglingConnections.push({
          uniqueName: conn.uniqueName,
          source: conn.source,
          target: conn.target,
          reason: `Source '${conn.source}' no es un componente existente`,
        });
      }
      if (conn.target && !componentNames.has(conn.target)) {
        danglingConnections.push({
          uniqueName: conn.uniqueName,
          source: conn.source,
          target: conn.target,
          reason: `Target '${conn.target}' no es un componente existente`,
        });
      }
    }

    const contextNames = [...new Set(job.contexts.map((c) => c.name))];
    const possibleMissingValues = job.contexts
      .filter((c) => !c.value || c.value.trim() === "")
      .map((c) => c.name);

    const schemaWarnings: string[] = [];
    let totalSchemas = 0;
    for (const comp of job.components) {
      if (comp.schemas) {
        for (const schema of comp.schemas) {
          totalSchemas++;
          for (const col of schema.columns) {
            if (!col.name || col.name.trim() === "") {
              schemaWarnings.push(
                `${comp.uniqueName}/${schema.name ?? schema.label ?? "schema"}: columna sin nombre`,
              );
            }
          }
        }
      }
    }

    const ws = resolveWorkspaceFromProject(projectPath);
    const logPath = join(ws.metadataPath, ".log");
    let latestStatus: "success" | "error" | "unknown" | undefined;
    let latestError: string | undefined;
    try {
      const logText = await readTextFile(logPath, ws.workspacePath);
      const latest = parseLatestRunLog(logText, resolvedJobName);
      latestStatus = latest.status;
      if (latest.errors.length > 0) {
        latestError = latest.errors.map((e) => `${e.line}: ${e.message}`).join("\n");
      }
    } catch {
      latestStatus = "unknown";
    }

    const report: JobDiagnosticReport = {
      jobName: resolvedJobName,
      itemPath: target.itemPath,
      propertiesPath: target.propertiesPath,
      components: {
        total: job.components.length,
        byType,
        missingUniqueNames,
      },
      connections: {
        total: job.connections.length,
        danglingConnections,
      },
      contexts: {
        total: job.contexts.length,
        names: contextNames,
        possibleMissingValues,
      },
      schemas: {
        total: totalSchemas,
        warnings: schemaWarnings,
      },
      logs: {
        latestStatus,
        latestError,
      },
      warnings: [],
    };

    if (missingUniqueNames.length > 0) {
      report.warnings.push(
        `${missingUniqueNames.length} componente(s) sin uniqueName: ${missingUniqueNames.join(", ")}`,
      );
    }
    if (danglingConnections.length > 0) {
      report.warnings.push(
        `${danglingConnections.length} conexión(es) colgante(s)`,
      );
    }
    if (possibleMissingValues.length > 0) {
      report.warnings.push(
        `${possibleMissingValues.length} contexto(s) sin valor: ${possibleMissingValues.join(", ")}`,
      );
    }

    return {
      ok: true,
      source: "filesystem",
      confidence: "high",
      data: report,
    };
  } catch (err) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error diagnosticando job: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
