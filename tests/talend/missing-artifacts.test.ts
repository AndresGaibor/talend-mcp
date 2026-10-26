import { describe, expect, test } from "bun:test";
import { findMissingArtifacts, missingArtifactsHint } from "../../src/talend/studio/missing-artifacts";

/**
 * Dependencias Maven que faltan al compilar un job (INTERNALS 25). Los textos
 * de ejemplo son los que escribe Studio al fallar el build.
 */
describe("findMissingArtifacts", () => {
  test("lee la coordenada completa del mensaje Missing artifact", () => {
    const found = findMissingArtifacts("Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0");
    expect(found).toEqual([
      {
        groupId: "com.jayway.jsonpath",
        artifactId: "json-path",
        version: "2.9.0",
        coordinate: "com.jayway.jsonpath:json-path:2.9.0",
      },
    ]);
  });

  test("acepta la coordenada sin tipo (grupo:artefacto:version)", () => {
    const found = findMissingArtifacts("Missing artifact org.foo:bar:1.2.3");
    expect(found).toEqual([
      { groupId: "org.foo", artifactId: "bar", version: "1.2.3", coordinate: "org.foo:bar:1.2.3" },
    ]);
  });

  test("con solo el nombre del jar no hay groupId: se devuelve sin coordenada", () => {
    const found = findMissingArtifacts(
      "El contenedor Maven Dependencies referencia biblioteca ...json-path-2.9.0.jar inexistente",
    );
    expect(found).toEqual([{ groupId: null, artifactId: "json-path", version: "2.9.0", coordinate: null }]);
  });

  test("no duplica el mismo artefacto cuando sale en las dos formas", () => {
    const text = [
      "Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0",
      "...json-path-2.9.0.jar inexistente",
    ].join("\n");
    expect(findMissingArtifacts(text)).toHaveLength(1);
  });

  test("funciona sobre un JSON serializado, como lo recibe la tool de compilacion", () => {
    const payload = { compiles: false, error: { message: "Offline / Missing artifact org.foo:bar:jar:1.0" } };
    expect(findMissingArtifacts(JSON.stringify(payload))).toEqual([
      { groupId: "org.foo", artifactId: "bar", version: "1.0", coordinate: "org.foo:bar:1.0" },
    ]);
  });

  test("sin dependencias que faltar devuelve una lista vacia", () => {
    expect(findMissingArtifacts('{"compiles":true}')).toEqual([]);
  });
});

describe("missingArtifactsHint", () => {
  test("indica la llamada de instalacion cuando hay coordenadas", () => {
    const hint = missingArtifactsHint([
      { groupId: "com.jayway.jsonpath", artifactId: "json-path", version: "2.9.0", coordinate: "com.jayway.jsonpath:json-path:2.9.0" },
    ]);
    expect(hint).toContain("com.jayway.jsonpath:json-path:2.9.0");
    expect(hint).toContain("installMissing:true");
  });

  test("sin groupId pide buscar la coordenada en vez de inventarla", () => {
    const hint = missingArtifactsHint([{ groupId: null, artifactId: "json-path", version: "2.9.0", coordinate: null }]);
    expect(hint).toContain("json-path-2.9.0.jar");
    expect(hint).toContain("talend_studio_install_artifact");
  });
});
