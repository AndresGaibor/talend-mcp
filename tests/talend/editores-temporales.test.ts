import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EDITOR_DE_JOB, type EditorAbierto } from "../../src/talend/studio/editores-guardados";
import { cerrarEditoresAbiertosPor } from "../../src/talend/studio/editores-temporales";

function editor(title: string, dirty = false): EditorAbierto {
  return { title, id: EDITOR_DE_JOB, dirty };
}

function puenteFalso(despues: EditorAbierto[], cerrados: string[] = []) {
  return {
    async workbenchState() {
      return {
        ok: true,
        source: "studio-bridge" as const,
        confidence: "high" as const,
        endpoint: "/workbench/state",
        data: { windows: [{ openEditors: despues }] },
      };
    },
    async closeEditor(title: string) {
      cerrados.push(title);
      return {
        ok: true,
        source: "studio-bridge" as const,
        confidence: "high" as const,
        endpoint: "/workbench/close-editor",
        data: { closed: true },
      };
    },
  };
}

describe("cerrarEditoresAbiertosPor", () => {
  test("cierra solo el editor que abrio la operacion", async () => {
    const antes = [editor("Job MCP_Otro 0.1")];
    const despues = [...antes, editor("Job MCP_Nuevo 0.1")];
    const cerrados: string[] = [];

    const resultado = await cerrarEditoresAbiertosPor(puenteFalso(despues, cerrados), "MCP_Nuevo", antes);

    expect(resultado).toEqual(["Job MCP_Nuevo 0.1"]);
    expect(cerrados).toEqual(["Job MCP_Nuevo 0.1"]);
  });

  test("no cierra un editor que ya estaba abierto antes", async () => {
    const antes = [editor("Job MCP_Abierto 0.1")];
    const cerrados: string[] = [];

    const resultado = await cerrarEditoresAbiertosPor(puenteFalso(antes, cerrados), "MCP_Abierto", antes);

    expect(resultado).toEqual([]);
    expect(cerrados).toEqual([]);
  });

  test("conserva el editor si tiene cambios sin guardar", async () => {
    const antes: EditorAbierto[] = [];
    const despues = [editor("Job MCP_Sucio 0.1", true)];
    const cerrados: string[] = [];

    const resultado = await cerrarEditoresAbiertosPor(puenteFalso(despues, cerrados), "MCP_Sucio", antes);

    expect(resultado).toEqual([]);
    expect(cerrados).toEqual([]);
  });

  test("si no se pudo leer el estado inicial no cierra nada", async () => {
    const cerrados: string[] = [];
    const despues = [editor("Job MCP_Nuevo 0.1")];

    const resultado = await cerrarEditoresAbiertosPor(puenteFalso(despues, cerrados), "MCP_Nuevo", null);

    expect(resultado).toEqual([]);
    expect(cerrados).toEqual([]);
  });
});

/**
 * Las tools que abren un editor de job tienen que cerrarlo. Studio retiene
 * ~13 MB por editor, asi que una que se olvide es una fuga que crece con cada
 * llamada. Se comprueba en el codigo porque requieren Studio en vivo.
 */
describe("tools que abren editores", () => {
  const src = join(import.meta.dir, "..", "..", "src");
  const read = (relative: string) => readFileSync(join(src, relative), "utf8");

  test("talend_job_verify cierra el editor que abre", () => {
    const codigo = read("talend/studio/tools-job-verify.ts");
    expect(codigo).toContain("cerrarEditoresAbiertosPor(bridge, job, antes)");
    expect(codigo).toMatch(/finally\s*\{/);
  });

  test("crear un job desde spec cierra el editor que abre", () => {
    const codigo = read("talend/automation/job-automation/create-from-spec.ts");
    expect(codigo).toContain("cerrarEditoresAbiertosPor(bridge, spec.name, antes)");
  });

  test("aplicar un pipeline spec cierra el editor que abre", () => {
    const codigo = read("talend/studio/tools-job-spec/apply.ts");
    expect(codigo).toContain("cerrarEditoresAbiertosPor(bridge, input.name, antes)");
  });
});
