import { describe, expect, test } from "bun:test";
import {
  clasificarProblemas,
  clasificarSalida,
  juntar,
  problemasDe,
  resumir,
  sinTolerados,
} from "../../scripts/l5/avisos";

describe("clasificarSalida", () => {
  test("separa errores y avisos y deja pasar la salida normal", () => {
    const { errores, avisos } = clasificarSalida([
      "1;Ana",
      "[WARN ] 14:30:28 org.apache.hadoop.util.Shell- Did not find winutils.exe",
      "[ERROR] 14:30:29 prj.job- tFileInput_1 fichero no encontrado",
      "Exception in thread \"main\" java.lang.NoClassDefFoundError: x",
      "\tat routines.Job.run(Job.java:1)",
    ]);

    expect(avisos).toHaveLength(1);
    expect(errores).toHaveLength(2);
    expect(errores[1]).toContain("NoClassDefFoundError");
  });

  test("una fila de datos que dice Exception no es un error", () => {
    expect(clasificarSalida(["7;NullPointerException handler"]).errores).toEqual([]);
  });
});

describe("clasificarProblemas", () => {
  test("cuenta errores y avisos y descarta los informativos", () => {
    const { errores, avisos } = clasificarProblemas([
      { severity: "ERROR", node: "tMap_1", description: "No schema has been defined yet" },
      { severity: "WARNING", node: "tLogRow_1", description: "should have input link(s)" },
      { severity: "INFO", node: "tX_1", description: "nota" },
    ]);

    expect(errores).toEqual(["tMap_1: No schema has been defined yet"]);
    expect(avisos).toEqual(["tLogRow_1: should have input link(s)"]);
  });
});

describe("sinTolerados y juntar", () => {
  test("quita lo que el escenario declara esperado", () => {
    const hallazgos = juntar(
      { errores: ["[ERROR] reject esperado"], avisos: [] },
      { errores: ["[ERROR] otro"], avisos: ["[WARN ] winutils"] },
    );

    expect(sinTolerados(hallazgos, ["reject esperado", "winutils"])).toEqual({
      errores: ["[ERROR] otro"],
      avisos: [],
    });
  });
});

describe("resumir", () => {
  test("vacio no ocupa sitio en el informe", () => {
    expect(resumir("avisos", [])).toBe("");
  });

  test("anota cuantos hay y recorta la lista", () => {
    const texto = resumir("avisos", ["a", "b", "c", "d", "e"]);
    expect(texto).toBe("avisos (5): a | b | c (+2 mas)");
  });
});

describe("problemasDe", () => {
  test("lee los problemas con o sin el sobre del bridge", () => {
    const problema = { severity: "ERROR", node: "tMap_1", description: "x" };
    expect(problemasDe({ result: { problems: [problema] } })).toEqual([problema]);
    expect(problemasDe({ problems: [problema] })).toEqual([problema]);
  });

  test("una respuesta rara no rompe: lista vacia", () => {
    expect(problemasDe(undefined)).toEqual([]);
    expect(problemasDe({ problems: "no" })).toEqual([]);
  });
});
