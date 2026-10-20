import { describe, expect, test } from "bun:test";
import { discoverProjectPathFromWorkspace, getConfiguredProjectPath } from "../../src/talend/workspace";

/** Normaliza separadores para comparar rutas entre Windows y Unix. */
function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

const EXPECTED_PROJECT = "tests/fixtures/talend/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB";

describe("workspace resolution", () => {
  test("detecta el proyecto abierto desde el workspace", () => {
    const workspacePath = "tests/fixtures/talend/workspace";

    expect(toPosix(discoverProjectPathFromWorkspace(workspacePath) ?? "")).toBe(EXPECTED_PROJECT);
  });

  test("prioriza el workspace sobre una ruta hardcodeada cuando no hay proyecto explicito", () => {
    const env = {
      TALEND_WORKSPACE: "tests/fixtures/talend/workspace",
    };

    expect(toPosix(getConfiguredProjectPath(env) ?? "")).toBe(EXPECTED_PROJECT);
  });
});
