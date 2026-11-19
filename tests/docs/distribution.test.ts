import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERSION } from "../../src/version";

const ROOT = join(import.meta.dir, "..", "..");
const json = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

describe("distribucion", () => {
  test("package.json, plugin y marketplace declaran la misma version", () => {
    expect(json("plugins/talend-mcp/.claude-plugin/plugin.json").version).toBe(VERSION);
    expect(json(".claude-plugin/marketplace.json").plugins[0].version).toBe(VERSION);
  });

  test("la skill del plugin es identica a la del repo (copia: cp .claude/skills/talend-mcp/SKILL.md plugins/talend-mcp/skills/talend-mcp/)", () => {
    const repo = readFileSync(join(ROOT, ".claude/skills/talend-mcp/SKILL.md"), "utf8");
    const plugin = readFileSync(join(ROOT, "plugins/talend-mcp/skills/talend-mcp/SKILL.md"), "utf8");
    expect(plugin).toBe(repo);
  });

  test("el plugin lanza el binario por stdio con el preset agent", () => {
    const server = json("plugins/talend-mcp/.mcp.json").mcpServers["talend-mcp"];
    expect(server.command).toBe("talend-mcp");
    expect(server.args).toEqual(["serve"]);
    expect(server.env).toMatchObject({ TALEND_MCP_MODE: "stdio", TALEND_MCP_FILTER: "agent" });
  });
});
