import { buildTalendComponentEditPreview } from "../../../talend/editor";
import { readTextFile } from "../../../talend/files";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { findTalendJob } from "../../../talend/job-crud";
import { ok, fail } from "../common/response";
import { wrapHandler } from "../common/logger";

type SchemaColumnEditOptions = {
  uniqueName: string;
  schemaName: string;
  columnName: string;
  patch: {
    name?: string;
    type?: string;
    length?: number;
    precision?: number;
    nullable?: boolean;
    key?: boolean;
    sourceType?: string;
    pattern?: string;
  };
};

export function createPreviewSchemaTool() {
  return {
    name: "preview_talend_schema_column",
    description: "Muestra una previsualización del cambio en una columna de schema Talend.",
    inputSchema: {
      type: "object",
      properties: {
        jobName: { type: "string", description: "Nombre del job" },
        folderPath: { type: "string", description: "Carpeta del job" },
        uniqueName: { type: "string", description: "Nombre único del componente" },
        schemaName: { type: "string", description: "Nombre del schema" },
        columnName: { type: "string", description: "Nombre de la columna" },
        patch: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            length: { type: "number" },
            precision: { type: "number" },
            nullable: { type: "boolean" },
            key: { type: "boolean" },
            sourceType: { type: "string" },
            pattern: { type: "string" },
          },
        },
      },
      required: ["jobName", "uniqueName", "schemaName", "columnName", "patch"],
    },
    handler: wrapHandler("preview_talend_schema_column", async (input: SchemaColumnEditOptions & { jobName: string; folderPath?: string }) => {
      const start = Date.now();
      try {
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó TALEND_PROJECT ni workspace activo.", { startTime: start });
        const job = await findTalendJob(projectPath, input.jobName, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        const result = buildTalendComponentEditPreview(xml, { kind: "schema-column", uniqueName: input.uniqueName, schemaName: input.schemaName, columnName: input.columnName, patch: input.patch });
        return ok({ itemPath: job.itemPath, uniqueName: input.uniqueName, schemaName: input.schemaName, columnName: input.columnName, changed: result.changed, diff: result.diff }, { startTime: start });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no encontrado") || msg.includes("Columna no encontrada")) return fail("SCHEMA_NOT_FOUND", msg, { startTime: start });
        return fail("PREVIEW_SCHEMA_ERROR", msg, { startTime: start });
      }
    }),
  };
}