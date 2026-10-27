import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJobsFromTemplate, editJobsBatch, expandTemplate } from "../../src/talend/job-batch/batch";

let proyecto: string;

beforeAll(() => {
  proyecto = mkdtempSync(join(tmpdir(), "talend-batch-"));
});
afterAll(() => rmSync(proyecto, { recursive: true, force: true }));

const plantilla = {
  jobName: "MIG_{{tabla}}",
  folderPath: "migracion",
  components: [
    {
      uniqueName: "tFixedFlowInput_1",
      componentName: "tFixedFlowInput",
      schema: { name: "tFixedFlowInput_1", columns: [{ name: "id", type: "id_Integer" }] },
    },
    { uniqueName: "tLogRow_1", componentName: "tLogRow", parameters: { LABEL: "{{tabla}}" } },
  ],
  connections: [{ source: "tFixedFlowInput_1", target: "tLogRow_1", label: "row1" }],
};

describe("expandTemplate", () => {
  test("sustituye variables en todos los textos", () => {
    expect(expandTemplate({ a: ["x_{{n}}"], b: { c: "{{n}}" } }, { n: 7 })).toEqual({ a: ["x_7"], b: { c: "7" } });
  });
  test("falla si falta una variable", () => {
    expect(() => expandTemplate({ a: "{{falta}}" }, {})).toThrow(/falta/);
  });
});

describe("lotes de jobs", () => {
  test("crea un job por fila y rechaza repetidos y existentes", async () => {
    const rows = [{ tabla: "CLIENTES" }, { tabla: "CUENTAS" }, { tabla: "CLIENTES" }];
    const primero = await createJobsFromTemplate({ projectPath: proyecto, template: plantilla, rows });
    expect(primero.filter((r) => r.ok).length).toBe(2);
    expect(primero.some((r) => r.error?.includes("repetido"))).toBe(true);
    expect(existsSync(join(proyecto, "process", "migracion", "MIG_CLIENTES_0.1.item"))).toBe(true);
    expect(existsSync(join(proyecto, "process", "migracion", "MIG_CLIENTES_0.1.properties"))).toBe(true);

    const segundo = await createJobsFromTemplate({ projectPath: proyecto, template: plantilla, rows: [{ tabla: "CLIENTES" }] });
    expect(segundo[0]!.error).toContain("ya existe");
  });

  test("dryRun no escribe", async () => {
    const r = await createJobsFromTemplate({ projectPath: proyecto, template: plantilla, rows: [{ tabla: "SECO" }], dryRun: true });
    expect(r[0]).toMatchObject({ ok: true, written: false });
    expect(existsSync(join(proyecto, "process", "migracion", "MIG_SECO_0.1.item"))).toBe(false);
  });

  test("edita todos los jobs que casan con el patron", async () => {
    const out = await editJobsBatch({
      projectPath: proyecto,
      namePattern: "^MIG_",
      operations: [{ op: "set_params", uniqueName: "tLogRow_1", parameters: { TABLE_PRINT: "true" } }],
    });
    expect(out.matched).toBe(2);
    expect(out.results.every((r) => r.ok && r.written)).toBe(true);
    expect(readFileSync(join(proyecto, "process", "migracion", "MIG_CUENTAS_0.1.item"), "utf8")).toContain("TABLE_PRINT");
  });

  test("un job que falla no impide los demas y no se toca", async () => {
    const out = await editJobsBatch({
      projectPath: proyecto,
      jobs: ["MIG_CLIENTES"],
      operations: [{ op: "remove_node", uniqueName: "no_existe" }],
    });
    expect(out.results[0]!.ok).toBe(false);
  });
});
