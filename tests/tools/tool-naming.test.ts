import { test, expect, describe } from "bun:test";
import { getAllRuntimeTools } from "../../src/server/registered-tools";

describe("Convencion de nombres de tools", () => {
  test("toda tool registrada usa el prefijo talend_", () => {
    const offenders = getAllRuntimeTools()
      .map((tool) => tool.name)
      .filter((name) => !name.startsWith("talend_"));

    expect(
      offenders,
      `Tools sin prefijo talend_:\n${offenders.join("\n")}`,
    ).toHaveLength(0);
  });

  test("no hay nombres de tool duplicados", () => {
    const names = getAllRuntimeTools().map((tool) => tool.name);
    const duplicados = names.filter((name, index) => names.indexOf(name) !== index);

    expect(
      [...new Set(duplicados)],
      `Tools duplicadas:\n${[...new Set(duplicados)].join("\n")}`,
    ).toHaveLength(0);
  });

  test("toda tool destructiva declara requiresConfirmation", () => {
    const destructivas = getAllRuntimeTools().filter((tool) => {
      const verbos = ["create", "apply", "patch", "restore", "delete"];
      return verbos.some((verbo) => tool.name.toLowerCase().includes(verbo));
    });

    const sinConfirmacion = destructivas.filter(
      (tool) => tool.annotations?.requiresConfirmation !== true,
    );

    expect(
      sinConfirmacion.map((tool) => tool.name),
      `Tools destructivas sin requiresConfirmation`,
    ).toHaveLength(0);
  });
});
