import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { componentTools } from "../../src/talend/studio/tools-components";
import { getCatalogStatus } from "../../src/talend/components/component-catalog-store";
import { ComponentCacheRepository } from "../../src/modules/component-knowledge/infrastructure/component-cache.repository";

const originalCwd = process.cwd();
let tempRoot: string | undefined;

afterEach(() => {
  process.chdir(originalCwd);
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("Talend component scan", () => {
  test("escanea la carpeta plugins y actualiza las dos cachés usadas por el MCP", async () => {
    tempRoot = mkdtempSync(join(tmpdir(), "talend-component-scan-"));
    process.chdir(tempRoot);
    const pluginsDir = join(tempRoot, "plugins");
    const componentDir = join(pluginsDir, "org.talend.test", "components", "tExample");
    mkdirSync(componentDir, { recursive: true });
    writeFileSync(join(componentDir, "tExample_java.xml"), `
      <COMPONENT>
        <HEADER NAME="tExample" FAMILY="Processing" VERSION="1.0" />
        <PARAMETERS><PARAMETER NAME="FILENAME" FIELD="TEXT" REQUIRED="true" DEFAULT="input.csv" /></PARAMETERS>
        <CONNECTORS><CONNECTOR NAME="FLOW" TYPE="FLOW" /></CONNECTORS>
      </COMPONENT>
    `);

    const tool = componentTools.find((entry) => entry.name === "talend_components_scan_installed") as
      | { handler: (args: { pluginsDir: string }) => Promise<unknown> }
      | undefined;
    expect(tool).toBeDefined();
    const result = await tool!.handler({ pluginsDir });

    expect((result as { structuredContent?: { ok?: boolean } }).structuredContent?.ok).toBe(true);
    expect((await new ComponentCacheRepository().getStatus()).componentCount).toBe(1);
    expect((await getCatalogStatus()).entryCount).toBe(1);
  });
});
