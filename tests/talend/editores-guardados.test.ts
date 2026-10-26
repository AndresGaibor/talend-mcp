import { describe, expect, test } from "bun:test";

import { EDITOR_DE_JOB, planificarCierre } from "../../src/talend/studio/editores-guardados";

const job = (title: string, dirty: boolean | undefined = false) => ({ title, id: EDITOR_DE_JOB, dirty });

describe("planificarCierre", () => {
  test("cierra los editores de jobs guardados", () => {
    const plan = planificarCierre([job("Job MCP_L5_Join 0.1"), job("Job MCP_L5_Hijo 0.1")]);
    expect(plan.cerrar).toEqual(["Job MCP_L5_Join 0.1", "Job MCP_L5_Hijo 0.1"]);
    expect(plan.conservar).toEqual([]);
  });

  test("nunca cierra un editor con cambios sin guardar", () => {
    const plan = planificarCierre([job("Job MCP_L5_Json 0.1", true)]);
    expect(plan.cerrar).toEqual([]);
    expect(plan.conservar).toEqual([{ title: "Job MCP_L5_Json 0.1", motivo: "tiene cambios sin guardar" }]);
  });

  test("si un titulo tiene una copia sucia, se conservan todas sus copias", () => {
    const plan = planificarCierre([
      job("Job MCP_L5_Join 0.1", false),
      job("Job MCP_L5_Join 0.1", true),
      job("Job MCP_L5_Join 0.1", false),
    ]);
    expect(plan.cerrar).toEqual([]);
    expect(plan.conservar).toHaveLength(1);
  });

  test("un editor de estado desconocido tambien se conserva", () => {
    const plan = planificarCierre([{ title: "Job MCP_L5_Hijo 0.1", id: EDITOR_DE_JOB }]);
    expect(plan.cerrar).toEqual([]);
    expect(plan.conservar[0]?.motivo).toBe("no se sabe si tiene cambios sin guardar");
  });

  test("repite el titulo por cada copia guardada, para cerrarlas todas", () => {
    const plan = planificarCierre([job("Job MCP_L5_Join 0.1"), job("Job MCP_L5_Join 0.1")]);
    expect(plan.cerrar).toEqual(["Job MCP_L5_Join 0.1", "Job MCP_L5_Join 0.1"]);
  });

  test("con prefijo solo toma los jobs cuyo nombre empieza por el", () => {
    const plan = planificarCierre(
      [job("Job MCP_L5_Hijo 0.1"), job("Job Cliente_Final 0.1")],
      "MCP_L5_",
    );
    expect(plan.cerrar).toEqual(["Job MCP_L5_Hijo 0.1"]);
  });

  test("ignora Welcome, vistas y editores que no son de un job", () => {
    const plan = planificarCierre([
      { title: "Welcome", id: "org.talend.rcp.intro.starting.StartingBrowser", dirty: false },
      { title: "Job MCP_L5_Hijo 0.1", id: "otro.editor", dirty: false },
    ]);
    expect(plan.cerrar).toEqual([]);
    expect(plan.conservar).toEqual([]);
  });

  test("reconoce el asterisco de un editor sucio en el titulo", () => {
    const plan = planificarCierre([job("*Job MCP_L5_Json 0.1", true)]);
    expect(plan.conservar).toHaveLength(1);
    expect(plan.cerrar).toEqual([]);
  });
});
