import { describe, expect, test } from "bun:test";
import { extractProjectPathFromLsofOutput } from "../../src/talend/workspace";

describe("workspace project autodetect", () => {
  test("extrae la carpeta del proyecto Talend desde lsof", () => {
    const lsofOutput = `Talend-St 16382 andresgaibor  548u      REG               1,17   9437184           116267746 /Applications/TalendStudio-8.0.1/studio/workspace/ALIWARECALIDAD/.Work_MapDB/_nYdqkF6dEfGQ0ed-VkYKHg
Talend-St 16382 andresgaibor   30r      REG               1,17       235           116155321 /Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/.git/objects/pack/pack-79bc1a46f5b8c298317e0c233203aad72a9a576e.pack`;

    expect(extractProjectPathFromLsofOutput(lsofOutput)).toBe(
      "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD",
    );
  });
});
