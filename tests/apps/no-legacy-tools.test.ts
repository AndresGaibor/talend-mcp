import { test, expect, describe } from "bun:test";
import { PRESENTATION_APP_DEFINITIONS } from "../../src/presentation/apps/app-registry";
import { LEGACY_TO_CANONICAL } from "../../src/modules/legacy/legacy-aliases";

const legacyToolNames = new Set(LEGACY_TO_CANONICAL.map(([legacy]) => legacy));

function isLegacyTool(toolName: string): boolean {
  return legacyToolNames.has(toolName);
}

describe("MCP Apps no usan tools legacy", () => {
  test("ninguna acción de app usa un nombre de tool legacy", () => {
    const errores: string[] = [];
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      for (const action of app.actions) {
        if (isLegacyTool(action.toolName)) {
          errores.push(`${action.toolName} en ${app.id} es un legacy tool`);
        }
      }
    }
    expect(
      errores.length,
      `Las siguientes actions usan tools legacy:\n${errores.join("\n")}`,
    ).toBe(0);
  });
});