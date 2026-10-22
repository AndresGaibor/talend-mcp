import { describe, expect, test } from "bun:test";
import { getAllRuntimeTools } from "../../src/server/registered-tools";
import { createDeleteJobTool } from "../../src/presentation/tools/jobs/delete-job.tool";
import { createDuplicateJobTool } from "../../src/presentation/tools/jobs/duplicate-job.tool";
import { createUpsertRepositoryContextParameterTool } from "../../src/presentation/tools/contexts/upsert-repository-context-parameter.tool";

const tools = getAllRuntimeTools();

describe("Conformidad de tools registradas", () => {
  test("los nombres son canonicos y unicos", () => {
    const invalidos = tools.filter((tool) => !tool.name.startsWith("talend_")).map((tool) => tool.name);
    const names = tools.map((tool) => tool.name);
    const duplicados = names.filter((name, index) => names.indexOf(name) !== index);

    expect(invalidos, `Tools sin prefijo canonico: ${invalidos.join(", ")}`).toEqual([]);
    expect([...new Set(duplicados)], `Tools duplicadas: ${[...new Set(duplicados)].join(", ")}`).toEqual([]);
  });

  test("cada tool registrada expone schemas de entrada y salida", () => {
    const incompletas = tools
      .filter((tool) => !tool.inputSchema || !tool.outputSchema)
      .map((tool) => tool.name);

    expect(incompletas, `Tools sin schema: ${incompletas.join(", ")}`).toEqual([]);
  });

  test("los schemas publicados son objetos JSON Schema", () => {
    const invalidos = tools.flatMap((tool) => {
      const schemas = [tool.inputSchema, tool.outputSchema];
      return schemas.some((schema) => typeof schema !== "object" || schema === null || !("type" in schema))
        ? [tool.name]
        : [];
    });
    expect(invalidos, `Schemas que no son JSON Schema: ${invalidos.join(", ")}`).toEqual([]);
  });

  test("cada tool tiene anotaciones MCP coherentes", () => {
    const invalidas = tools.flatMap((tool) => {
      const annotations = tool.annotations;
      if (!annotations) return [`${tool.name}: sin anotaciones`];

      const errors: string[] = [];
      for (const field of ["readOnlyHint", "idempotentHint", "destructiveHint", "openWorldHint"] as const) {
        if (typeof annotations[field] !== "boolean") errors.push(`${tool.name}: ${field} no es booleano`);
      }
      if (annotations.readOnlyHint && annotations.destructiveHint) {
        errors.push(`${tool.name}: read-only y destructiva`);
      }
      if (annotations.readOnlyHint && !annotations.idempotentHint) {
        errors.push(`${tool.name}: read-only no idempotente`);
      }
      if (annotations.destructiveHint && annotations.requiresConfirmation !== true) {
        errors.push(`${tool.name}: acción destructiva sin confirmación`);
      }
      if (/create|apply|patch|restore|delete/i.test(tool.name) && annotations.requiresConfirmation !== true) {
        errors.push(`${tool.name}: verbo de escritura sin confirmación`);
      }
      return errors;
    });

    expect(invalidas).toEqual([]);
  });

  test("los contratos esenciales siguen registrados", () => {
    const names = new Set(tools.map((tool) => tool.name));
    const required = [
      "talend_jobs_list",
      "talend_jobs_read",
      "talend_jobs_create",
      "talend_delete_job",
      "talend_duplicate_job",
      "talend_upsert_repository_context_parameter",
    ];
    const missing = required.filter((name) => !names.has(name));

    expect(missing, `Faltan tools esenciales: ${missing.join(", ")}`).toEqual([]);
  });

  test("los schemas vivos de borrar, duplicar y upsert conservan sus campos obligatorios", () => {
    const deleteSchema = createDeleteJobTool().inputSchema;
    const duplicateSchema = createDuplicateJobTool().inputSchema;
    const upsertSchema = createUpsertRepositoryContextParameterTool().inputSchema;

    expect(deleteSchema.safeParse({ jobName: "ventas" }).success).toBe(true);
    expect(deleteSchema.safeParse({}).success).toBe(false);
    expect(duplicateSchema.safeParse({ sourceJobName: "origen", targetJobName: "copia" }).success).toBe(true);
    expect(duplicateSchema.safeParse({ sourceJobName: "origen" }).success).toBe(false);
    expect(upsertSchema.required).toEqual(["contextName", "parameterName", "value"]);
    expect(upsertSchema.properties).toHaveProperty("contextName_param");
  });
});
