import { describe, expect, test } from "bun:test";
import { extractWorkspacePathFromLsofOutput } from "../../src/talend/workspace";

describe("workspace autodetect", () => {
  test("extrae el workspace abierto desde lsof", () => {
    const lsofOutput = `Talend-St 16382 andresgaibor  548u      REG               1,17   9437184           116267746 /Applications/TalendStudio-8.0.1/studio/workspace/ALIWARECALIDAD/.Work_MapDB/_nYdqkF6dEfGQ0ed-VkYKHg`;

    expect(extractWorkspacePathFromLsofOutput(lsofOutput)).toBe(
      "/Applications/TalendStudio-8.0.1/studio/workspace/ALIWARECALIDAD",
    );
  });
});
