import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyJson, applyToml, configureClient, isCompiledBinary, launcherFor, targetFor, type Launcher, type SetupDeps,
} from "../../src/cli/client-setup";

const launcher: Launcher = { command: "C:/x/talend-mcp.exe", args: ["serve"], env: { TALEND_MCP_MODE: "stdio" } };
const roots: string[] = [];
const sandbox = () => { const d = mkdtempSync(join(tmpdir(), "setup-")); roots.push(d); return d; };
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

const deps = (home: string, calls: string[][] = []): SetupDeps => ({
  dirs: { home, appData: join(home, "AppData", "Roaming"), platform: "win32" },
  which: (cmd) => (cmd === "claude" ? "claude" : null),
  run: (cmd) => { calls.push(cmd); return { ok: true, output: "" }; },
});

describe("launcherFor", () => {
  test("un binario compilado se lanza con serve y fija su estado", () => {
    const l = launcherFor({ execPath: "C:\\Users\\a\\.talend-mcp\\bin\\talend-mcp.exe", repoRoot: "/r", home: "C:\\Users\\a", project: "C:\\p" });
    expect(l.command).toBe("C:/Users/a/.talend-mcp/bin/talend-mcp.exe");
    expect(l.args).toEqual(["serve"]);
    expect(l.env).toMatchObject({ TALEND_MCP_MODE: "stdio", TALEND_MCP_FILTER: "agent", TALEND_PROJECT: "C:/p", TALEND_MCP_HOME: "C:/Users/a/.talend-mcp/state" });
  });

  test("desde el repo se lanza con bun --cwd y sin TALEND_MCP_HOME", () => {
    const l = launcherFor({ execPath: "C:\\bun\\bun.exe", repoRoot: "C:\\repo", home: "C:\\Users\\a" });
    expect(l.args).toEqual(["run", "--cwd", "C:/repo", "index.ts"]);
    expect(l.env.TALEND_MCP_HOME).toBeUndefined();
  });
});

describe("isCompiledBinary", () => {
  test("distingue bun de un binario compilado con rutas de cualquier plataforma", () => {
    expect(isCompiledBinary(String.raw`C:\bun\bun.exe`)).toBe(false);
    expect(isCompiledBinary("/usr/local/bin/bun")).toBe(false);
    expect(isCompiledBinary(String.raw`C:\Users\a\.talend-mcp\bin\talend-mcp.exe`)).toBe(true);
    expect(isCompiledBinary("/home/a/.talend-mcp/bin/talend-mcp")).toBe(true);
  });
});

describe("applyJson", () => {
  test("conserva los demas servidores y claves", () => {
    const text = JSON.stringify({ theme: "dark", mcpServers: { otro: { command: "x" } } });
    const out = JSON.parse(applyJson(text, "mcpServers", { command: "bun" }));
    expect(out.theme).toBe("dark");
    expect(out.mcpServers.otro).toEqual({ command: "x" });
    expect(out.mcpServers["talend-mcp"]).toEqual({ command: "bun" });
  });

  test("crea el archivo desde cero y quitar deja el resto", () => {
    expect(JSON.parse(applyJson(undefined, "servers", { command: "a" })).servers["talend-mcp"]).toBeDefined();
    const removed = JSON.parse(applyJson(applyJson(undefined, "servers", { command: "a" }), "servers", null));
    expect(removed.servers).toEqual({});
  });

  test("un archivo que no es JSON no se modifica", () => {
    expect(() => applyJson("{ // comentario\n}", "servers", { command: "a" })).toThrow(/no es JSON valido/);
    expect(() => applyJson("[1]", "servers", { command: "a" })).toThrow();
  });
});

describe("applyToml", () => {
  test("es idempotente y conserva el resto del archivo", () => {
    const base = 'model = "o3"\n';
    const once = applyToml(base, launcher);
    expect(applyToml(once, launcher)).toBe(once);
    expect(once).toContain('model = "o3"');
    expect(once.match(/\[mcp_servers\.talend-mcp\]/g)).toHaveLength(1);
  });

  test("actualiza el bloque y lo quita sin tocar lo demas", () => {
    const once = applyToml('model = "o3"\n', launcher);
    expect(applyToml(once, { ...launcher, args: ["serve", "--x"] })).toContain('"--x"');
    expect(applyToml(once, null)).toBe('model = "o3"\n');
  });
});

describe("targetFor", () => {
  test("rutas por plataforma", () => {
    const win = { home: "C:/u", appData: "C:/u/AppData/Roaming", platform: "win32" as const };
    expect(targetFor("claude-desktop", win)).toMatchObject({ path: join("C:/u/AppData/Roaming", "Claude", "claude_desktop_config.json"), rootKey: "mcpServers" });
    expect(targetFor("vscode", win)).toMatchObject({ rootKey: "servers", extra: { type: "stdio" } });
    expect(targetFor("claude-desktop", { home: "/h", platform: "darwin" })).toMatchObject({ path: join("/h", "Library", "Application Support", "Claude", "claude_desktop_config.json") });
    expect(targetFor("claude-desktop", { home: "/h", platform: "linux" })).toMatchObject({ path: join("/h", ".config", "Claude", "claude_desktop_config.json") });
  });
});

describe("configureClient", () => {
  test("escribe, hace copia la primera vez y no pisa otros servidores", () => {
    const home = sandbox();
    const path = join(home, ".cursor", "mcp.json");
    mkdirSync(join(home, ".cursor"));
    writeFileSync(path, JSON.stringify({ mcpServers: { otro: { command: "x" } } }));
    const first = configureClient("cursor", launcher, deps(home), false);
    expect(first.status).toBe("applied");
    expect(existsSync(`${path}.bak-talend-mcp`)).toBe(true);
    configureClient("cursor", { ...launcher, args: ["serve", "v2"] }, deps(home), false);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    expect(Object.keys(doc.mcpServers).sort()).toEqual(["otro", "talend-mcp"]);
    expect(doc.mcpServers["talend-mcp"].args).toEqual(["serve", "v2"]);
    expect(JSON.parse(readFileSync(`${path}.bak-talend-mcp`, "utf8")).mcpServers.otro).toBeDefined();
  });

  test("copilot usa mcpServers con type local y tools, y respeta COPILOT_HOME", () => {
    const home = sandbox();
    const copilotHome = join(home, "otra");
    const d = deps(home);
    expect(configureClient("copilot", launcher, { ...d, dirs: { ...d.dirs, copilotHome } }, false).status).toBe("applied");
    const entry = JSON.parse(readFileSync(join(copilotHome, "mcp-config.json"), "utf8")).mcpServers["talend-mcp"];
    expect(entry).toMatchObject({ type: "local", tools: ["*"], command: launcher.command, args: ["serve"] });
    expect(existsSync(join(home, ".copilot"))).toBe(false);
  });

  test("--dry-run no escribe nada", () => {
    const home = sandbox();
    const out = configureClient("gemini", launcher, deps(home), true);
    expect(out.status).toBe("dry-run");
    expect(existsSync(join(home, ".gemini"))).toBe(false);
  });

  test("un JSON roto se reporta como error y se deja intacto", () => {
    const home = sandbox();
    mkdirSync(join(home, ".gemini"));
    writeFileSync(join(home, ".gemini", "settings.json"), "{ roto");
    expect(configureClient("gemini", launcher, deps(home), false).status).toBe("error");
    expect(readFileSync(join(home, ".gemini", "settings.json"), "utf8")).toBe("{ roto");
  });

  test("claude-code usa la CLI: quita y registra, o quita sin mas", () => {
    const calls: string[][] = [];
    expect(configureClient("claude-code", launcher, deps(sandbox(), calls), false).status).toBe("applied");
    expect(calls.map((c) => c.slice(1, 3).join(" "))).toEqual(["mcp remove", "mcp add-json"]);
    const json = JSON.parse(calls[1]![4]!);
    expect(json).toMatchObject({ type: "stdio", command: launcher.command, args: ["serve"] });
    const removeCalls: string[][] = [];
    configureClient("claude-code", null, deps(sandbox(), removeCalls), false);
    expect(removeCalls).toHaveLength(1);
  });

  test("quitar donde nunca se configuro no crea archivos", () => {
    const home = sandbox();
    expect(configureClient("codex", null, deps(home), false).status).toBe("skipped");
    expect(existsSync(join(home, ".codex"))).toBe(false);
  });
});
