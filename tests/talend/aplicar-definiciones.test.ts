import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aplicarDefiniciones } from "../../src/talend/job-batch/aplicar-definiciones";
import { createJobsFromTemplate } from "../../src/talend/job-batch/batch";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

const FILTRO = {
  name: "tFilterRow",
  parameters: [
    {
      name: "LOGICAL_OP", field: "CLOSED_LIST", required: true, show: true, advanced: false,
      options: [{ name: "OR", value: "||" }, { name: "AND", value: "&&" }],
    },
    {
      name: "CONDITIONS", field: "TABLE", required: false, show: true, advanced: false,
      table: {
        basedOnSchema: false, rows: 3,
        columns: [
          { name: "INPUT_COLUMN" },
          { name: "FUNCTION", options: [{ name: "EMPTY", value: "" }], defaultValue: "" },
          { name: "OPERATOR", options: [{ name: "EQUAL", value: "==" }, { name: "GREATER", value: ">" }], defaultValue: "==" },
          { name: "RVALUE" },
        ],
      },
    },
  ],
} as unknown as ComponentDefinition;

const buscar = async (name: string) => (name === "tFilterRow" ? FILTRO : null);

type Plantilla = {
  jobName: string;
  folderPath: string;
  components: Array<{
    uniqueName: string;
    componentName: string;
    parameters?: Record<string, string>;
    tables?: Record<string, { columns?: string[]; rows: string[][] }>;
  }>;
};

const plantilla: Plantilla = {
  jobName: "job_con_filtro",
  folderPath: "Process/Pruebas",
  components: [
    {
      uniqueName: "tFilterRow_1",
      componentName: "tFilterRow",
      parameters: { LOGICAL_OP: "AND" },
      tables: { CONDITIONS: { columns: ["INPUT_COLUMN", "OPERATOR", "RVALUE"], rows: [["credit_limit", "GREATER", "0"]] } },
    },
    { uniqueName: "tRaro_2", componentName: "tRaro", parameters: { X: "1" } },
  ],
};

let proyecto: string;
beforeAll(() => { proyecto = mkdtempSync(join(tmpdir(), "talend-defs-")); });
afterAll(() => rmSync(proyecto, { recursive: true, force: true }));

test("traduce listas y convierte las tablas en celdas, y avisa de lo que no puede traducir", async () => {
  const { plantilla: lista, avisos } = await aplicarDefiniciones(plantilla, buscar);
  const filtro = lista.components[0]! as { parameters: Record<string, unknown>; tables?: unknown };

  expect(filtro.tables).toBeUndefined();
  expect(filtro.parameters.LOGICAL_OP).toEqual({ value: "&&", field: "CLOSED_LIST" });
  expect(filtro.parameters.CONDITIONS).toEqual([
    { "@_elementRef": "INPUT_COLUMN", "@_value": "credit_limit", "@_id": "0" },
    { "@_elementRef": "FUNCTION", "@_value": "", "@_id": "1" },
    { "@_elementRef": "OPERATOR", "@_value": ">", "@_id": "2" },
    { "@_elementRef": "RVALUE", "@_value": "0", "@_id": "3" },
  ]);
  expect(avisos.join(" ")).toContain("tRaro");
});

test("el .item escrito guarda el valor de la lista, el tipo de campo y la tabla", async () => {
  const { plantilla: lista } = await aplicarDefiniciones(plantilla, buscar);
  const [resultado] = await createJobsFromTemplate({ projectPath: proyecto, template: lista as never, rows: [{}] });

  expect(resultado!.ok).toBe(true);
  const xml = readFileSync(resultado!.itemPath!, "utf8");
  expect(xml).toContain('name="LOGICAL_OP"');
  expect(xml).toMatch(/field="CLOSED_LIST"[^>]*name="LOGICAL_OP"[^>]*value="&amp;&amp;"|name="LOGICAL_OP"[^>]*value="&amp;&amp;"/);
  expect(xml).not.toContain('value="AND"');
  expect(xml).toMatch(/field="TABLE"[^>]*name="CONDITIONS"|name="CONDITIONS"[^>]*field="TABLE"/);
  expect(xml).toContain('elementRef="OPERATOR"');
  expect(xml).toContain('value="&gt;"');
});

test("un componente sin parametros tambien recibe los valores por defecto de sus listas", async () => {
  const { plantilla: lista } = await aplicarDefiniciones(
    { jobName: "j", components: [{ uniqueName: "tFilterRow_1", componentName: "tFilterRow" }] },
    async (nombre) => ({
      name: nombre,
      parameters: [{
        name: "LOGICAL_OP", field: "CLOSED_LIST", required: true, show: true, advanced: false, defaultOption: "AND",
        options: [{ name: "OR", value: "||" }, { name: "AND", value: "&&" }],
      }],
    }) as unknown as ComponentDefinition,
  );

  expect((lista.components[0] as unknown as { parameters: Record<string, unknown> }).parameters.LOGICAL_OP).toEqual({ value: "&&", field: "CLOSED_LIST" });
});

test("la definicion de cada componente se consulta una sola vez por lote", async () => {
  let consultas = 0;
  await aplicarDefiniciones(
    { jobName: "j", components: [
      { uniqueName: "tLogRow_1", componentName: "tLogRow" },
      { uniqueName: "tLogRow_2", componentName: "tLogRow" },
    ] },
    async () => { consultas++; return null; },
  );

  expect(consultas).toBe(1);
});
