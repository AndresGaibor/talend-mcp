import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { buildChecklist, createPackage, collectJobFiles } from "../deliverables/deliverable-packager";

export const deliverableTools = [
  {
    name: "talend_deliverable_export_job",
    description: "Prepara un paquete de entregable para un job.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      destinationDir: z.string().optional().describe("Directorio destino para el paquete"),
    }),
    handler: async (input: { jobName: string; destinationDir?: string }) => {
      try {
        const files = collectJobFiles(input.jobName);
        const pkg = createPackage(input.jobName, files);

        return bridgeOk({
          ok: true,
          source: "deliverables",
          confidence: "high",
          endpoint: "/deliverable/export-job",
          data: {
            jobName: input.jobName,
            fileCount: files.length,
            package: pkg,
            zipNote: "Necesita integración con zip del sistema",
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
    name: "talend_deliverable_collect_files",
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
    name: "talend_deliverable_create_package",
    description: "Crea un paquete ZIP de entregable.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      files: z.array(z.object({
        path: z.string(),
        type: z.enum(["job", "context", "schema", "script", "readme", "other"]),
        description: z.string().optional(),
      })).describe("Lista de archivos a incluir"),
    }),
    handler: async (input: { jobName: string; files: Array<{ path: string; type: "job" | "context" | "schema" | "script" | "readme" | "other"; description?: string }> }) => {
      try {
        const pkg = createPackage(input.jobName, input.files);
        return bridgeOk({
          ok: true,
          source: "deliverables",
          confidence: "high",
          endpoint: "/deliverable/create-package",
          data: { package: pkg },
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
    name: "talend_deliverable_validate_checklist",
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
