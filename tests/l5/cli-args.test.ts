import { describe, expect, test } from "bun:test";

import { argumento, posicional } from "../../scripts/l5/cli-args";
import { parseEscenarios } from "../../scripts/l5/scenario-filters";

describe("argumentos del arnes", () => {
  const args = ["transformaciones", "--suite", "bd", "--desde", "HEAD", "--validar"];

  test("lee --clave valor y --clave=valor", () => {
    expect(argumento(args, "suite")).toBe("bd");
    expect(argumento(["--suite=aws"], "suite")).toBe("aws");
    expect(argumento(args, "inexistente")).toBeUndefined();
  });

  test("posicional ignora las opciones y sus valores", () => {
    expect(posicional(args, ["--suite", "--desde"])).toBe("transformaciones");
    expect(posicional(["--suite", "bd"], ["--suite", "--desde"])).toBeUndefined();
  });
});

describe("lectura de escenarios para --desde", () => {
  test("acepta una lista y un objeto con escenarios", () => {
    const escenario = { nombre: "x", job: "J", nodos: [], conexiones: [] };
    expect(parseEscenarios(JSON.stringify([escenario]))).toEqual([escenario]);
    expect(parseEscenarios(JSON.stringify({ escenarios: [escenario] }))).toEqual([escenario]);
  });

  test("quita el BOM que deja PowerShell", () => {
    const escenario = { nombre: "x", job: "J", nodos: [], conexiones: [] };
    expect(parseEscenarios(`\uFEFF${JSON.stringify([escenario])}`)).toEqual([escenario]);
  });
});
