import { test, expect, describe } from "bun:test";
import { PRESENTATION_APP_DEFINITIONS } from "../../src/presentation/apps/app-registry";
import { getLegacyAliases } from "../../src/server/tool-registry";

function isLegacyTool(toolName: string): boolean {
  const legacyAliases = getLegacyAliases();
  return legacyAliases.has(toolName);
}

describe("MCP Apps no usan tools legacy", () => {
  test("ninguna acción de app usa un nombre de tool legacy", () => {
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      for (const action of app.actions) {
        expect(
          isLegacyTool(action.toolName),
          `${action.toolName} en ${app.id} es un legacy tool`,
        ).toBe(false);
      }
    }
  });
});
