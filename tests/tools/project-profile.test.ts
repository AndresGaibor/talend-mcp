import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectInventory } from "../../src/modules/project-profile/application/project-inventory";
import { detectConventions, findGaps, findReuseCandidates } from "../../src/modules/project-profile/application/project-analysis";
import { createProjectProfileTool } from "../../src/modules/project-profile/tools/project-profile.tool";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "project-profile-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function touch(base: string, rel: string): void {
  const file = join(base, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "");
}

test("lee items de cada categoria e ignora lo que no es .item", () => {
  touch(root, "process/Carga/Carga_Datos_SS_0.1.item");
  touch(root, "process/Carga/Carga_Datos_SS_0.1.properties");
  touch(root, "process/.gitkeep");
  touch(root, "context/Azure/POC_RUNTIME_0.1.item");
  touch(root, "metadata/connections/DB_ORACLE_0.1.item");
  const inv = readProjectInventory(root);
  expect(inv.jobs).toEqual([{ name: "Carga_Datos_SS", version: "0.1", folder: "Carga" }]);
  expect(inv.contexts[0]).toEqual({ name: "POC_RUNTIME", version: "0.1", folder: "Azure" });
  expect(inv.metadata.connections?.[0]?.name).toBe("DB_ORACLE");
  expect(inv.joblets).toEqual([]);
});

test("el orden es determinista aunque el sistema de archivos devuelva otro", () => {
  touch(root, "process/B/z_0.1.item");
  touch(root, "process/A/b_0.1.item");
  touch(root, "process/A/a_0.1.item");
  const inv = readProjectInventory(root);
  expect(inv.jobs.map((j) => `${j.folder}/${j.name}`)).toEqual(["A/a", "A/b", "B/z"]);
});

test("ordena por codigo de caracter, no por el orden case-insensitive del sistema", () => {
  touch(root, "process/Z_0.1.item");
  touch(root, "process/a_0.1.item");
  const inv = readProjectInventory(root);
  expect(inv.jobs.map((j) => j.name)).toEqual(["Z", "a"]);
});

test("un proyecto sin carpetas opcionales no falla", () => {
  mkdirSync(join(root, "process"), { recursive: true });
  const inv = readProjectInventory(root);
  expect(inv).toEqual({ jobs: [], joblets: [], contexts: [], routines: [], metadata: {} });
});

test("nombres con guiones bajos y items en la raiz de la categoria", () => {
  touch(root, "process/Carga_Datos_SS_0.1.item");
  touch(root, "process/Carga/Sub/Otro_Job_1.2.item");
  const inv = readProjectInventory(root);
  expect(inv.jobs).toEqual([
    { name: "Carga_Datos_SS", version: "0.1", folder: "" },
    { name: "Otro_Job", version: "1.2", folder: "Carga/Sub" },
  ]);
});

test("detecta el prefijo dominante y no inventa convenciones", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "" });
  const inv = { jobs: ["EP_a", "EP_b", "EP_c", "x_d"].map(item), joblets: [], contexts: [], routines: [], metadata: {} };
  expect(detectConventions(inv)).toEqual([{ category: "jobs", prefix: "EP", count: 3, total: 4 }]);

  const sin = { ...inv, jobs: ["prueba", "otro", "mas"].map(item) };
  expect(detectConventions(sin)).toEqual([]);
});

test("un proyecto vacio devuelve todos los huecos", () => {
  const vacio = { jobs: [], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findGaps(vacio)).toHaveLength(4);
  expect(findGaps(vacio)).toEqual([
    "No hay contextos de proyecto: pregunta que variables y entornos usar.",
    "No hay conexiones de base de datos en el repositorio: pregunta a que base de datos conectar.",
    "El proyecto no tiene jobs: no hay convenciones que deducir; pregunta como nombrarlos.",
    "No hay joblets: la logica comun va en un job hijo con tRunJob.",
  ]);
});

test("una convencion necesita al menos el 50 % de la categoria", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "" });
  // 3 de 10 items comparten prefijo: 30 %, por debajo del umbral.
  const names = ["EP_1", "EP_2", "EP_3", "otro1", "otro2", "otro3", "otro4", "otro5", "otro6", "otro7"];
  const inv = { jobs: names.map(item), joblets: [], contexts: [], routines: [], metadata: {} };
  expect(detectConventions(inv)).toEqual([]);
});

test("ante empate de frecuencia gana el prefijo alfabeticamente menor", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "" });
  const inv = { jobs: ["B_1", "B_2", "B_3", "A_1", "A_2", "A_3"].map(item), joblets: [], contexts: [], routines: [], metadata: {} };
  expect(detectConventions(inv)).toEqual([{ category: "jobs", prefix: "A", count: 3, total: 6 }]);
});

test("encuentra candidatos de reutilizacion por palabras del proposito", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  const inv = { jobs: [item("Carga_Clientes"), item("Otro")], joblets: [], contexts: [item("CTX_clientes")], routines: [], metadata: {} };
  expect(findReuseCandidates(inv, "cargar Clientes a la base").map((c) => c.name)).toEqual(["Carga_Clientes", "CTX_clientes"]);
});

test("un proposito sin palabras de 3 o mas letras no devuelve candidatos", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  // Si se ignorara el filtro de 3 letras, "de" y "la" casarian con este item.
  const inv = { jobs: [item("de_la_base")], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findReuseCandidates(inv, "de la")).toEqual([]);
});

test("limita los candidatos a 10", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  const jobs = Array.from({ length: 12 }, (_, i) => item(`carga_${i}`));
  const inv = { jobs, joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findReuseCandidates(inv, "carga")).toHaveLength(10);
});

test("ignora tildes al buscar candidatos", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  // Proposito con tilde contra item sin tilde: solo casa si se quitan tildes del proposito.
  const sinTilde = { jobs: [item("arbo_x")], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findReuseCandidates(sinTilde, "árbol").map((c) => c.name)).toEqual(["arbo_x"]);
  // Item con tilde contra proposito sin tilde: solo casa si se quitan tildes del nombre.
  const conTilde = { jobs: [item("Árbol_db")], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findReuseCandidates(conTilde, "arbol").map((c) => c.name)).toEqual(["Árbol_db"]);
});

test("la tool devuelve inventario recortado con el total real y los huecos", async () => {
  for (let i = 0; i < 5; i++) touch(root, `process/EP_job${i}_0.1.item`);
  const tool = createProjectProfileTool();
  const res = await tool.handler({ projectPath: root, limit: 2, purpose: "job" });
  const data = res.data as any;
  expect(data.inventory.jobs.total).toBe(5);
  expect(data.inventory.jobs.items).toHaveLength(2);
  expect(data.conventions[0].prefix).toBe("EP");
  expect(data.gaps.length).toBeGreaterThan(0);
  expect(data.reuseCandidates.length).toBeGreaterThan(0);
});

test("un projectPath sin carpeta process responde INVALID_PROJECT_PATH, con o sin proyecto configurado", async () => {
  // Ruta explicita que no es un proyecto: no se cae nunca al proyecto configurado.
  const res = await createProjectProfileTool().handler({ projectPath: root });
  expect(res.ok).toBe(false);
  expect(res.errors?.[0]?.code).toBe("INVALID_PROJECT_PATH");
});

test("limit debe ser un entero positivo", () => {
  const schema = createProjectProfileTool().inputSchema;
  expect(schema.safeParse({ limit: 0 }).success).toBe(false);
  expect(schema.safeParse({ limit: 1.5 }).success).toBe(false);
  expect(schema.safeParse({ limit: 3 }).success).toBe(true);
});

test("una palabra casa solo si su raiz es prefijo de un token del nombre", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  const inv = { jobs: [item("Descarga_Datos_SS"), item("Carga_Clientes_01")], joblets: [], contexts: [], routines: [], metadata: {} };
  // "carga" no debe casar con "Descarga" (subcadena, no prefijo de token).
  expect(findReuseCandidates(inv, "carga clientes").map((c) => c.name)).toEqual(["Carga_Clientes_01"]);
});

test("las palabras funcionales del proposito no generan candidatos", () => {
  const item = (name: string) => ({ name, version: "0.1", folder: "f" });
  const inv = { jobs: [item("para_todo")], joblets: [], contexts: [], routines: [], metadata: {} };
  expect(findReuseCandidates(inv, "para")).toEqual([]);
});

test("no reporta hueco de conexiones si hay conexiones o JDBC en metadata", () => {
  const base = { jobs: [], joblets: [], contexts: [], routines: [], metadata: {} };
  const hueco = "No hay conexiones de base de datos en el repositorio: pregunta a que base de datos conectar.";
  expect(findGaps(base)).toContain(hueco);
  expect(findGaps({ ...base, metadata: { connections: [{ name: "DB", version: "0.1", folder: "" }] } })).not.toContain(hueco);
  expect(findGaps({ ...base, metadata: { JDBC: [{ name: "JDBC_ORA", version: "0.1", folder: "" }] } })).not.toContain(hueco);
});
