import { describe, expect, test } from "bun:test";

import { jobsDelEscenario } from "../../scripts/l5/scenario-runner";
import type { Escenario } from "../../scripts/l5/scenario-types";

const escenarioBase = { nombre: "control: padre con hijo", job: "MCP_L5_Padre" } as Escenario;

describe("jobs que monta un escenario", () => {
  test("sin auxiliares, solo el principal", () => {
    expect(jobsDelEscenario(escenarioBase)).toEqual(["MCP_L5_Padre"]);
  });

  test("incluye los auxiliares antes que el principal, para borrarlos todos", () => {
    const escenario = {
      ...escenarioBase,
      jobs: [{ job: "MCP_L5_Hijo" }, { job: "MCP_L5_Nieto" }],
    } as unknown as Escenario;
    expect(jobsDelEscenario(escenario)).toEqual(["MCP_L5_Hijo", "MCP_L5_Nieto", "MCP_L5_Padre"]);
  });
});
