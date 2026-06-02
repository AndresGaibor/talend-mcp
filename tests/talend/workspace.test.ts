import { describe, expect, test } from "bun:test";
import { discoverProjectPathFromWorkspace, getConfiguredProjectPath } from "../../src/talend/workspace";

describe("workspace resolution", () => {
  test("detecta el proyecto abierto desde el workspace", () => {
    const workspacePath = "tests/fixtures/talend/workspace";

    expect(discoverProjectPathFromWorkspace(workspacePath)).toBe(
      "tests/fixtures/talend/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB",
    );
  });

  test("prioriza el workspace sobre una ruta hardcodeada cuando no hay proyecto explicito", () => {
    const env = {
      TALEND_WORKSPACE: "tests/fixtures/talend/workspace",
    };

    expect(getConfiguredProjectPath(env)).toBe(
      "tests/fixtures/talend/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB",
    );
  });
});
