import { describe, expect, test } from "bun:test";
import { KNOWN_SUITES, selectScenarios, suiteOf } from "../../scripts/l5/scenario-selection";

const scenarios = [
  { nombre: "archivos: leer CSV" },
  { nombre: "transformaciones: filtrar filas" },
  { nombre: "bases de datos: leer Postgres" },
  { nombre: "control de flujo: trigger" },
  { nombre: "futuro: pendiente", pendiente: "falta preparar el fixture" },
];

describe("seleccion de escenarios L5", () => {
  test("clasifica escenarios en suites por su categoria", () => {
    expect(scenarios.map((scenario) => suiteOf(scenario.nombre))).toEqual([
      "archivos", "transformaciones", "bd", "control", "otros",
    ]);
  });

  test("combina filtros y omite escenarios marcados como pendientes", () => {
    const selected = selectScenarios(scenarios, {
      suite: "bd",
      nameFilter: "postgres",
      failedNames: new Set(["bases de datos: leer Postgres"]),
      changedNames: new Set(["bases de datos: leer Postgres"]),
    });
    expect(selected.map((scenario) => scenario.nombre)).toEqual(["bases de datos: leer Postgres"]);
  });

  test("no selecciona resultados que pasaron al reintentar solo fallidos", () => {
    const selected = selectScenarios(scenarios, { failedNames: new Set(["control de flujo: trigger"]) });
    expect(selected.map((scenario) => scenario.nombre)).toEqual(["control de flujo: trigger"]);
  });

  test("las categorias con suite propia se filtran sin caer en 'otros'", () => {
    expect(suiteOf("aws: subir a S3")).toBe("aws");
    expect(suiteOf("privacidad: enmascarar documento")).toBe("privacidad");
    expect(KNOWN_SUITES.has("aws")).toBe(true);
    expect(KNOWN_SUITES.has("privacidad")).toBe(true);
    expect(suiteOf("futuro: pendiente")).toBe("otros");
  });
});
