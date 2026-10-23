import { describe, expect, test } from "bun:test";
import { Validator } from "@cfworker/json-schema";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAllRuntimeTools } from "../../src/server/registered-tools";
import { createListJobsTool } from "../../src/presentation/tools/jobs/list-jobs.tool";
import { createReadContextsTool } from "../../src/presentation/tools/jobs/read-contexts.tool";
import { createRepoSourcesTool } from "../../src/presentation/tools/repo/repo-sources.tool";
import { clearActiveRepo } from "../../src/talend/workspace";

/**
 * Los outputSchema publicados se validan del lado del cliente: el SDK de MCP de
 * Python rechaza cualquier respuesta que no los cumpla. Si una tool empieza a
 * devolver campos que el schema no declara, el cliente ve un error de protocolo
 * en vez del dato (fue el fallo que dejó al portal sin conexion con el MCP).
 *
 * Estas pruebas ejecutan las tools reales contra un proyecto de prueba y
 * comprueban que su respuesta valida contra el schema publicado.
 */

const tools = getAllRuntimeTools();
const byName = new Map(tools.map((tool) => [tool.name, tool]));

function schemaExigeSource(name: string): boolean {
  const schema = byName.get(name)?.outputSchema as { required?: string[] } | undefined;
  return Array.isArray(schema?.required) && schema!.required!.includes("source");
}

function validar(name: string, instance: unknown): string[] {
  const tool = byName.get(name);
  if (!tool) return [`Falta la tool ${name}`];
  // El cliente MCP valida el contenido estructurado serializado; emular la
  // serializacion JSON descarta propiedades `undefined`, que en JSON no existen.
  const serializado = JSON.parse(JSON.stringify(instance));
  const result = new Validator(tool.outputSchema as Record<string, unknown>).validate(serializado);
  return result.valid ? [] : result.errors.map((error) => `${name}: ${error.error}`);
}

/** Proyecto Talend mínimo en un temp dir, con el job del fixture copiado dentro. */
function crearProyectoDePrueba(): string {
  const dir = mkdtempSync(join(tmpdir(), "talend-mcp-conformance-"));
  const project = join(dir, "PRJ_CONFORMANCE");
  const carpeta = join(project, "process", "bloque2_talend_base");
  mkdirSync(carpeta, { recursive: true });
  const origen = join("tests", "fixtures", "talend");
  for (const archivo of [
    "lab04_olist_orders_to_staging_0.1.item",
    "lab04_olist_orders_to_staging_0.1.properties",
  ]) {
    copyFileSync(join(origen, archivo), join(carpeta, archivo));
  }
  return project;
}

describe("OutputSchema publicado contra la respuesta real", () => {
  test("ningún outputSchema publicado es estricto (additionalProperties: false)", () => {
    const estrictas = tools
      .filter((tool) => JSON.stringify(tool.outputSchema).includes('"additionalProperties":false'))
      .map((tool) => tool.name);
    expect(estrictas, `Schemas publicados estrictos: ${estrictas.join(", ")}`).toEqual([]);
  });

  test("cada tool acepta el envelope TalendResult de éxito y de fallo", () => {
    const fallos: string[] = [];
    for (const tool of tools) {
      fallos.push(...validar(tool.name, { ok: true, source: tool.name, confidence: "high", durationMs: 5 }));
      fallos.push(
        ...validar(tool.name, {
          ok: false,
          source: tool.name,
          confidence: "none",
          errors: [{ code: "TEST_ERROR", message: "fallo de prueba" }],
        }),
      );
    }
    expect(fallos).toEqual([]);
  });

  test("las tools con envelope corto aceptan ok/fail sin source ni confidence", () => {
    const fallos: string[] = [];
    for (const tool of tools) {
      if (schemaExigeSource(tool.name)) continue;
      fallos.push(...validar(tool.name, { ok: true }));
      fallos.push(...validar(tool.name, { ok: false, error: { code: "TEST_ERROR", message: "fallo de prueba" } }));
    }
    expect(fallos).toEqual([]);
  });

  test("talend_jobs_list: la respuesta real valida contra su outputSchema publicado", async () => {
    const project = crearProyectoDePrueba();
    const anterior = process.env.TALEND_PROJECT;
    clearActiveRepo();
    process.env.TALEND_PROJECT = project;
    try {
      const tool = createListJobsTool();
      const resultado = await (tool.handler as (input: Record<string, never>) => Promise<unknown>)({});
      const envelope = resultado as { ok: boolean; data?: { jobs?: unknown[]; total?: number } };
      expect(envelope.ok).toBe(true);
      expect(validar("talend_jobs_list", resultado)).toEqual([]);
      expect(envelope.data?.total).toBeGreaterThan(0);
      const job = (envelope.data?.jobs as Array<Record<string, unknown>>)[0]!;
      for (const campo of ["name", "version", "path", "folder", "modified", "size", "components"]) {
        expect(Object.keys(job), `Falta el campo ${campo} en la respuesta de talend_jobs_list`).toContain(campo);
      }
    } finally {
      restoreEnv("TALEND_PROJECT", anterior);
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("talend_read_contexts: la respuesta real valida contra su outputSchema publicado", async () => {
    const project = crearProyectoDePrueba();
    const anterior = process.env.TALEND_PROJECT;
    clearActiveRepo();
    process.env.TALEND_PROJECT = project;
    try {
      const tool = createReadContextsTool();
      const resultado = await (tool.handler as (input: { jobName: string }) => Promise<unknown>)({
        jobName: "lab04_olist_orders_to_staging",
      });
      const envelope = resultado as { ok: boolean; error?: { code: string } };
      expect(envelope.ok, `talend_read_contexts falló: ${JSON.stringify(envelope.error)}`).toBe(true);
      expect(validar("talend_read_contexts", resultado)).toEqual([]);
    } finally {
      restoreEnv("TALEND_PROJECT", anterior);
      rmSync(project, { recursive: true, force: true });
    }
  });

  // Payload real capturado contra un workspace con Studio abierto: el item del
  // repositorio trae versión y entornos, no `parameters` en la raíz. El SDK de
  // Python rechazaba toda la respuesta por ese campo obligatorio inexistente.
  test("talend_list_repository_contexts: un item real valida contra su outputSchema", () => {
    const respuesta = {
      ok: true,
      source: "list-repository-contexts",
      confidence: "high",
      data: {
        contexts: [
          { name: "prueba_4", version: "0.1", contexts: [] },
          {
            name: "produccion",
            version: "0.1",
            defaultContext: "Datasets",
            contexts: [
              { name: "Datasets", parameters: [{ name: "db_host", type: "id_String", value: "10.0.0.1" }] },
            ],
          },
        ],
        project: "PRJ_CONFORMANCE",
      },
    };
    expect(validar("talend_list_repository_contexts", respuesta)).toEqual([]);
  });

  test("talend_read_repository_context: el item leido valida contra su outputSchema", () => {
    const respuesta = {
      ok: true,
      source: "read-repository-context",
      confidence: "high",
      data: {
        context: {
          name: "prueba_4",
          version: "0.1",
          contexts: [{ name: "Datasets", parameters: [{ name: "fichero_entrada" }] }],
        },
      },
    };
    expect(validar("talend_read_repository_context", respuesta)).toEqual([]);
  });

  test("talend_repo_sources: la respuesta real valida contra su outputSchema", async () => {
    // Ejecuta la tool de verdad (solo lee la caché local): el schema publicado
    // declaraba `sources: string[]` y la tool devuelve `repos: CachedRepo[]`.
    const tool = createRepoSourcesTool();
    const resultado = await (tool.handler as () => Promise<unknown>)();
    expect(validar("talend_repo_sources", resultado)).toEqual([]);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
