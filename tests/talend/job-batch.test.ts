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

describe("guarda de jobs abiertos", () => {
  test("reconoce el titulo del editor de un job", async () => {
    const { esEditorDelJob } = await import("../../src/talend/job-batch/open-guard");
    expect(esEditorDelJob("Job MIG_A 0.1", "MIG_A")).toBe(true);
    expect(esEditorDelJob("*Job MIG_A 0.1", "MIG_A")).toBe(true);
    expect(esEditorDelJob("Job MIG_AB 0.1", "MIG_A")).toBe(false);
    expect(esEditorDelJob("Welcome", "MIG_A")).toBe(false);
  });
});

describe("ruta de los jobs creados", () => {
  test("cada job escrito informa la ruta de su .item", async () => {
    const [resultado] = await createJobsFromTemplate({ projectPath: proyecto, template: plantilla, rows: [{ tabla: "CON_RUTA" }] });

    expect(resultado!.ok).toBe(true);
    expect(resultado!.itemPath).toBe(join(proyecto, "process", "migracion", "MIG_CON_RUTA_0.1.item"));
    expect(existsSync(resultado!.itemPath!)).toBe(true);
  });
});

describe("carpeta con la convencion de Studio", () => {
  test("una carpeta que empieza por Process/ cuelga de process/, no de process/Process/", async () => {
    const [resultado] = await createJobsFromTemplate({
      projectPath: proyecto,
      template: { ...plantilla, jobName: "MIG_CARPETA_STUDIO", folderPath: "Process/Portal/Cargas" },
      rows: [{ tabla: "X" }],
    });

    expect(resultado!.ok).toBe(true);
    expect(resultado!.itemPath).toBe(join(proyecto, "process", "Portal", "Cargas", "MIG_CARPETA_STUDIO_0.1.item"));
  });

  test("Process a secas es la raiz de process/ y una carpeta relativa se respeta", async () => {
    const [raiz] = await createJobsFromTemplate({
      projectPath: proyecto,
      template: { ...plantilla, jobName: "MIG_RAIZ", folderPath: "Process" },
      rows: [{ tabla: "X" }],
    });
    const [relativa] = await createJobsFromTemplate({
      projectPath: proyecto,
      template: { ...plantilla, jobName: "MIG_RELATIVA", folderPath: "otra/carpeta" },
      rows: [{ tabla: "X" }],
    });

    expect(raiz!.itemPath).toBe(join(proyecto, "process", "MIG_RAIZ_0.1.item"));
    expect(relativa!.itemPath).toBe(join(proyecto, "process", "otra", "carpeta", "MIG_RELATIVA_0.1.item"));
  });
});
