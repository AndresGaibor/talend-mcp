import * as z from "zod/v4";
import { join } from "node:path";
import { bridgeOk, bridgeFail, bridgeResultToEnvelope, loadBridge } from "./tools-base";
import { buildChecklist, createPackage, collectJobFiles } from "../deliverables/deliverable-packager";
import { createPlatformContext } from "../../platform";
import { toTalendHostPath } from "../../platform/path-bridge";

const BUILD_JOB_ENDPOINT = "/automation/build-job";

/**
 * Carpeta de builds por defecto: `TALEND_BUILDS_DIR/<job>`. La variable va en la forma de Studio
 * (la misma que lee `talend_find_exported_jobs`), asi que no hace falta convertirla.
 */
function defaultBuildDir(jobName: string): string | undefined {
  const raw = process.env.TALEND_BUILDS_DIR;
  return raw ? join(raw, jobName) : undefined;
}

export const deliverableTools = [
  {
    name: "talend_deliverables_build_job",
    description:
      "Construye un job como Build Job: zip autonomo con launcher (_run.bat/_run.sh), jar, lib/ y contexto, extraido en la carpeta de builds. Ejecutalo sin Studio con talend_runs_start_exported. Guarda el job en Studio antes de construirlo.",
    annotations: { readOnly: false, requiresConfirmation: true },
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job, ya compilado en Studio"),
      contextName: z.string().optional().default("Default").describe("Contexto que usa el launcher por defecto"),
      version: z.string().optional().default("0.1").describe("Version del job"),
      destinationDir: z
        .string()
        .optional()
        .describe("Carpeta del build. Por defecto, TALEND_BUILDS_DIR/<jobName>"),
    }),
    handler: async (input: { jobName: string; contextName?: string; version?: string; destinationDir?: string }) => {
      const ctx = createPlatformContext();
      const destination = input.destinationDir
        ? toTalendHostPath(input.destinationDir, ctx)
        : defaultBuildDir(input.jobName);
      if (!destination) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: BUILD_JOB_ENDPOINT,
          error: {
            code: "NO_BUILDS_DIR",
            message: "No hay carpeta de build: define TALEND_BUILDS_DIR o pasa destinationDir.",
          },
        });
      }

      const bridge = await loadBridge();
      const result = await bridge.buildJob({
        job: input.jobName,
        destination,
        version: input.version,
        context: input.contextName,
      });
      const envelope = bridgeResultToEnvelope(result, BUILD_JOB_ENDPOINT);
      return envelope.ok ? bridgeOk(envelope) : bridgeFail(envelope);
    },
  },
  {
    name: "talend_deliverables_export_job",
    description: "Prepara un paquete de entregable para un job.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      destinationDir: z.string().optional().describe("Directorio destino para el paquete"),
    }),
    handler: async (input: { jobName: string; destinationDir?: string }) => {
      try {
        const files = collectJobFiles(input.jobName);
        const pkg = await createPackage(input.jobName, files, input.destinationDir);

        return bridgeOk({
          ok: true,
          source: "deliverables",
          confidence: "high",
          endpoint: "/deliverable/export-job",
          data: {
            jobName: input.jobName,
            fileCount: files.length,
            package: pkg,
            zipPath: pkg.zipPath ?? null,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "deliverables",
          confidence: "low",
          endpoint: "/deliverable/export-job",
          error: { code: "EXPORT_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_deliverables_collect",
    description: "Recolecta los archivos asociados a un job para entrega.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
    }),
    handler: async (input: { jobName: string }) => {
      try {
        const files = collectJobFiles(input.jobName);
        return bridgeOk({
          ok: true,
          source: "deliverables",
          confidence: "high",
          endpoint: "/deliverable/collect-files",
          data: { jobName: input.jobName, files, count: files.length },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "deliverables",
          confidence: "low",
          endpoint: "/deliverable/collect-files",
          error: { code: "COLLECT_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_deliverables_create_package",
    description: "Crea un paquete ZIP de entregable.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      files: z.array(z.object({
        path: z.string(),
        type: z.enum(["job", "context", "schema", "script", "readme", "other"]),
        description: z.string().optional(),
      })).describe("Lista de archivos a incluir"),
      destinationDir: z.string().optional().describe("Directorio destino para el ZIP"),
    }),
    handler: async (input: { jobName: string; files: Array<{ path: string; type: "job" | "context" | "schema" | "script" | "readme" | "other"; description?: string }>; destinationDir?: string }) => {
      try {
        const filesWithSize = input.files.map((f) => ({ ...f, sizeBytes: undefined as number | undefined }));
        const pkg = await createPackage(input.jobName, filesWithSize, input.destinationDir ?? `dist/talend-deliverables/${input.jobName.replace(/[^a-zA-Z0-9_-]/g, "_")}`);

        return bridgeOk({
          ok: true,
          source: "deliverables",
          confidence: "high",
          endpoint: "/deliverable/create-package",
          data: { package: pkg, zipPath: pkg.zipPath ?? null },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "deliverables",
          confidence: "low",
          endpoint: "/deliverable/create-package",
          error: { code: "PACKAGE_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_deliverables_validate",
    description: "Valida que un job cumpla con los requisitos de entregable.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      hasContexts: z.boolean().optional().default(false).describe("Si tiene archivos de contexto"),
      hasSchema: z.boolean().optional().default(false).describe("Si tiene documentación de schema"),
      hasDocumentation: z.boolean().optional().default(false).describe("Si tiene README"),
      outputTable: z.string().optional().describe("Nombre de tabla de output"),
      auditColumns: z.boolean().optional().default(false).describe("Si usa columnas de audit"),
      batchSize: z.number().optional().describe("Batch size configurado"),
    }),
    handler: async (input: { jobName: string; hasContexts?: boolean; hasSchema?: boolean; hasDocumentation?: boolean; outputTable?: string; auditColumns?: boolean; batchSize?: number }) => {
      try {
        const checklist = buildChecklist(input.jobName, {
          hasContexts: input.hasContexts ?? false,
          hasSchema: input.hasSchema ?? false,
          hasDocumentation: input.hasDocumentation ?? false,
          outputTable: input.outputTable,
          auditColumns: input.auditColumns,
          batchSize: input.batchSize,
        });

        return bridgeOk({
          ok: checklist.allChecked,
          source: "deliverables",
          confidence: checklist.allChecked ? "high" : "medium",
          endpoint: "/deliverable/validate-checklist",
          data: checklist,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "deliverables",
          confidence: "low",
          endpoint: "/deliverable/validate-checklist",
          error: { code: "CHECKLIST_FAILED", message: String(err) },
        });
      }
    },
  },
];
