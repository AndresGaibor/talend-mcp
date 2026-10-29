import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createComponentIconTool } from "../../src/modules/component-definitions/tools/component-icon.tool";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function plugins() {
  const root = mkdtempSync(join(tmpdir(), "talend-icons-"));
  roots.push(root);
  return root;
}

describe("talend_component_icon", () => {
  test("returns the component's original canvas SVG", async () => {
    const root = plugins();
    const folder = join(root, "org.talend.designer.components.localprovider_1", "components", "tFixture");
    mkdirSync(folder, { recursive: true });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
    writeFileSync(join(folder, "tFixture.svg"), svg);

    const result = await createComponentIconTool({ pluginsDir: root }).handler({ name: "tFixture" });
    expect(result).toMatchObject({ ok: true, data: { available: true, svg } });
  });

  test("does not substitute a palette PNG when no canvas SVG exists", async () => {
    const root = plugins();
    const folder = join(root, "org.talend.designer.components.localprovider_1", "components", "tFixture");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "tFixture_icon32.png"), "palette icon");

    const result = await createComponentIconTool({ pluginsDir: root }).handler({ name: "tFixture" });
    expect(result).toMatchObject({ ok: true, data: { available: false } });
  });
});
