/**
 * Escritura de los archivos .item y .properties del job generado en el proyecto.
 */
import * as z from "zod/v4";
import { join } from "node:path";
import { bridgeFail, bridgeOk, loadBridge } from "../tools-base";
import { generateJobSpec } from "../../jobs/pipeline-patterns";
import { toGeneratorSpec, validateGeneratorSpec } from "../../jobs/job-spec-generator";
import { buildJobItemXml, buildJobPropertiesXml } from "../../job-generator";
import { readTextFile, writeTextFile } from "../../files";
import { resolveProjectPath } from "../../workspace";
import { listJobs } from "../../repository";
import { createPlatformContext } from "../../../platform";
import { toTalendHostPath } from "../../../platform/path-bridge";
import type { PatrónTalend } from "../../task/task-types";

async function findExistingJob(projectPath: string, jobName: string): Promise<{ itemPath: string; propertiesPath: string } | null> {
  try {
    const jobs = await listJobs(projectPath);
    const matches = jobs.filter((job) => job.label === jobName);
    const match = matches[0];
    return matches.length === 1 && match
      ? { itemPath: match.itemPath, propertiesPath: match.propertiesPath }
      : null;
  } catch {
    return null;
  }
}

export const jobSpecApplyTools = [
  {
    name: "talend_jobs_apply_pipeline_spec",
    description: "Genera y escribe archivos .item y .properties reales en el proyecto Talend.",
    inputSchema: z.object({
      pattern: z.enum(["multi_csv_raw_loader", "csv_to_db_with_audit_columns", "sql_orchestration_job", "db_to_db_copy", "api_to_db_loader", "file_watcher_pipeline"]).describe("Patrón del pipeline"),
      name: z.string().describe("Nombre del job"),
      inputPath: z.string().optional().describe("Ruta de entrada"),
      outputTable: z.string().optional().describe("Tabla de salida"),
      batchSize: z.number().optional().describe("Batch size"),
      auditColumns: z.boolean().optional().default(true).describe("Incluir columnas de audit"),
      folderPath: z.string().optional().describe("Carpeta dentro de process/"),
    }),
    handler: async (input: { pattern: PatrónTalend; name: string; inputPath?: string; outputTable?: string; batchSize?: number; auditColumns?: boolean; folderPath?: string }) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) {
          return bridgeFail({
            ok: false,
            source: "workspace",
            confidence: "high",
            endpoint: "/job/apply-pipeline-spec",
            error: { code: "NO_PROJECT_PATH", message: "No se pudo determinar la ruta del proyecto Talend" },
          });
        }

        const logicalSpec = generateJobSpec(input.pattern, input.name, {
          inputPath: input.inputPath,
          outputTable: input.outputTable,
          batchSize: input.batchSize,
          auditColumns: input.auditColumns,
        });

        const genSpec = toGeneratorSpec(logicalSpec, { folderPath: input.folderPath });
        const genValidation = validateGeneratorSpec(genSpec);

        if (!genValidation.valid) {
          return bridgeFail({
            ok: false,
            source: "job-spec",
            confidence: "high",
            endpoint: "/job/apply-pipeline-spec",
            error: { code: "INVALID_GENERATOR_SPEC", message: genValidation.errors.join("; ") },
          });
        }

        const existingJob = await findExistingJob(projectPath, input.name);
        let snapshotCreated = false;
        let snapshotPath: string | undefined;

        if (existingJob) {
          try {
            const content = await readTextFile(existingJob.itemPath, projectPath);
            snapshotPath = existingJob.itemPath + ".snapshot_" + Date.now();
            await writeTextFile(snapshotPath, content, projectPath);
            snapshotCreated = true;
          } catch {
          }
        }

        const version = "0.1";
        const itemFileName = `${input.name}_${version}.item`;
        const folderParts = (input.folderPath ?? "Process").replace(/\\/g, "/").split("/").filter(Boolean);
        const jobDir = folderParts.length > 0
          ? join(projectPath, "process", ...folderParts)
          : join(projectPath, "process");

        const { mkdirSync } = await import("node:fs");
        mkdirSync(jobDir, { recursive: true });

        const itemPath = join(jobDir, itemFileName);
        const propertiesFileName = `${input.name}_${version}.properties`;
        const propertiesPath = join(jobDir, propertiesFileName);

        const { xml: itemXml, rootId } = buildJobItemXml(genSpec);
        const propertiesXml = buildJobPropertiesXml(genSpec, rootId);

        await writeTextFile(itemPath, itemXml, projectPath);
        await writeTextFile(propertiesPath, propertiesXml, projectPath);

        let bridgeRefreshed = false;
        let bridgeOpened = false;
        let problemsData: unknown = null;

        try {
          const ctx = createPlatformContext();
          const bridge = await loadBridge();
          await bridge.refreshWorkspace();

          const studioPath = toTalendHostPath(itemPath, ctx);
          const openResult = await bridge.openResource(studioPath);
          bridgeOpened = openResult.ok;

          const problemsResult = await bridge.problemsMarkers();
          if (problemsResult.ok && problemsResult.data) {
            problemsData = problemsResult.data;
          }
          bridgeRefreshed = true;
        } catch {
        }

        return bridgeOk({
          ok: true,
          source: "job-spec",
          confidence: "high",
          endpoint: "/job/apply-pipeline-spec",
          data: {
            jobName: input.name,
            version,
            itemPath,
            propertiesPath,
            folderPath: input.folderPath ?? "Process",
            snapshotCreated,
            snapshotPath,
            generatedComponents: genSpec.components.length,
            connections: genSpec.connections?.length ?? 0,
            bridgeRefreshed,
            bridgeOpened,
            problems: problemsData,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "job-spec",
          confidence: "low",
          endpoint: "/job/apply-pipeline-spec",
          error: { code: "APPLY_FAILED", message: String(err) },
        });
      }
    },
  },
];
