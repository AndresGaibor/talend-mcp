import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enlazarTRunJob } from "../../src/talend/job-batch/enlazar-trunjob";
import { createJobsFromTemplate } from "../../src/talend/job-batch/batch";

type Plantilla = { components: Array<{ componentName: string; parameters?: Record<string, string | { value: string; field?: string }> }> };

let proyecto: string;
beforeAll(() => {
  proyecto = mkdtempSync(join(tmpdir(), "talend-trunjob-"));
  writeFileSync(
    join(proyecto, "talend.project"),
    '<?xml version="1.0"?><TalendProperties:Project technicalLabel="PRJ_PRUEBA" label="Prueba"/>',
  );
  mkdirSync(join(proyecto, "process"), { recursive: true });
});
afterAll(() => rmSync(proyecto, { recursive: true, force: true }));

const padre = (proceso: string, extra: Record<string, unknown> = {}) => ({
  jobName: "job_padre",
  components: [
    { uniqueName: "tRunJob_1", componentName: "tRunJob", parameters: { PROCESS: { value: proceso, field: "PROCESS_TYPE" }, ...extra } },
    { uniqueName: "tLogRow_2", componentName: "tLogRow", parameters: {} },
  ],
});

test("escribe el id del job hijo, el contexto y la version como lo hace Studio", async () => {
  const [hijo] = await createJobsFromTemplate({
    projectPath: proyecto,
    template: { jobName: "job_hijo", components: [{ uniqueName: "tLogRow_1", componentName: "tLogRow" }] },
    rows: [{}],
  });
  expect(hijo!.ok).toBe(true);

  const { plantilla, avisos } = await enlazarTRunJob(proyecto, padre("job_hijo") as Plantilla);
  const parametros = (plantilla.components[0] as unknown as { parameters: Record<string, { value: string; field: string }> }).parameters;

  expect(avisos).toEqual([]);
  expect(parametros.PROCESS).toEqual({ value: "job_hijo", field: "PROCESS_TYPE" });
  expect(parametros["PROCESS:PROCESS_TYPE_PROCESS"]!.value).toMatch(/^PRJ_PRUEBA:_[A-Za-z0-9_-]{22}$/);
  expect(parametros["PROCESS:PROCESS_TYPE_PROCESS"]!.field).toBe("TECHNICAL");
  expect(parametros["PROCESS:PROCESS_TYPE_CONTEXT"]).toEqual({ value: "Default", field: "TECHNICAL" });
  expect(parametros["PROCESS:PROCESS_TYPE_VERSION"]).toEqual({ value: "Latest", field: "TECHNICAL" });
});

test("el id escrito es el del item del hijo, no uno inventado", async () => {
  const { plantilla } = await enlazarTRunJob(proyecto, padre("job_hijo") as Plantilla);
  const escrito = (plantilla.components[0] as unknown as { parameters: Record<string, { value: string }> }).parameters["PROCESS:PROCESS_TYPE_PROCESS"]!.value;
  const [hijo] = await createJobsFromTemplate({
    projectPath: proyecto,
    template: { jobName: "job_hijo", components: [{ uniqueName: "tLogRow_1", componentName: "tLogRow" }] },
    rows: [{}],
    overwrite: true,
  });
  expect(hijo!.ok).toBe(true);
  const { plantilla: despues } = await enlazarTRunJob(proyecto, padre("job_hijo") as Plantilla);
  const nuevo = (despues.components[0] as unknown as { parameters: Record<string, { value: string }> }).parameters["PROCESS:PROCESS_TYPE_PROCESS"]!.value;

  expect(escrito.startsWith("PRJ_PRUEBA:_")).toBe(true);
  expect(nuevo.startsWith("PRJ_PRUEBA:_")).toBe(true);
});

test("un hijo que todavia no existe se avisa y el tRunJob queda sin enlazar", async () => {
  const { plantilla, avisos } = await enlazarTRunJob(proyecto, padre("job_que_no_existe") as Plantilla);
  const parametros = (plantilla.components[0] as unknown as { parameters: Record<string, unknown> }).parameters;

  expect(avisos.join(" ")).toContain("job_que_no_existe");
  expect(Object.keys(parametros)).not.toContain("PROCESS:PROCESS_TYPE_PROCESS");
});

test("los componentes que no son tRunJob y los tRunJob sin PROCESS no se tocan", async () => {
  const entrada = {
    jobName: "j",
    components: [
      { uniqueName: "tLogRow_1", componentName: "tLogRow", parameters: { A: "1" } },
      { uniqueName: "tRunJob_2", componentName: "tRunJob", parameters: {} },
    ],
  };

  const { plantilla, avisos } = await enlazarTRunJob(proyecto, entrada as Plantilla);

  expect(plantilla).toEqual(entrada as Plantilla);
  expect(avisos).toEqual([]);
});

test("el contexto del hijo puede venir en la plantilla", async () => {
  const { plantilla } = await enlazarTRunJob(
    proyecto,
    padre("job_hijo", { "PROCESS:PROCESS_TYPE_CONTEXT": { value: "Prod", field: "TECHNICAL" } }) as Plantilla,
  );
  const parametros = (plantilla.components[0] as unknown as { parameters: Record<string, { value: string }> }).parameters;

  expect(parametros["PROCESS:PROCESS_TYPE_CONTEXT"]!.value).toBe("Prod");
});

test("un proyecto recien creado, sin carpeta process/, no rompe: el hijo simplemente no existe", async () => {
  const vacio = mkdtempSync(join(tmpdir(), "talend-vacio-"));
  try {
    const { plantilla, avisos } = await enlazarTRunJob(vacio, padre("job_hijo") as Plantilla);

    expect(avisos.join(" ")).toContain("job_hijo");
    expect(Object.keys((plantilla.components[0] as { parameters: Record<string, unknown> }).parameters)).not.toContain(
      "PROCESS:PROCESS_TYPE_PROCESS",
    );
  } finally {
    rmSync(vacio, { recursive: true, force: true });
  }
});
