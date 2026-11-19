import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Autoconfiguracion de clientes MCP: escribe (o quita) la entrada `talend-mcp` sin tocar el resto. */

export const SERVER_NAME = "talend-mcp";
export const CLIENT_IDS = ["claude-code", "claude-desktop", "vscode", "copilot", "cursor", "gemini", "codex"] as const;
export type ClientId = (typeof CLIENT_IDS)[number];

export type Launcher = { command: string; args: string[]; env: Record<string, string> };
export type Dirs = { home: string; appData?: string; copilotHome?: string; platform: NodeJS.Platform };

const slash = (path: string): string => path.replaceAll("\\", "/");

/** Binario compilado (talend-mcp) frente al runtime de bun. No usa path.basename: en POSIX no separa rutas con barra invertida. */
export const isCompiledBinary = (execPath: string): boolean => !/^bun(\.exe)?$/i.test(execPath.split(/[\\/]/).pop() ?? "");

/** Estado del servidor instalado por binario: catalogo, auditoria y ejecuciones. */
export const defaultStateHome = (home: string): string => slash(join(home, ".talend-mcp", "state"));

/**
 * Como lanzar el servidor desde un cliente. Un binario compilado se lanza solo (`serve`); desde el
 * repositorio se lanza con bun y `--cwd`, para que el estado quede dentro del repo.
 */
export function launcherFor(opts: { execPath: string; repoRoot: string; home: string; project?: string; filter?: string }): Launcher {
  const env: Record<string, string> = { TALEND_MCP_MODE: "stdio", TALEND_MCP_FILTER: opts.filter ?? "agent" };
  if (opts.project) env.TALEND_PROJECT = slash(opts.project);
  if (isCompiledBinary(opts.execPath)) {
    env.TALEND_MCP_HOME = defaultStateHome(opts.home);
    return { command: slash(opts.execPath), args: ["serve"], env };
  }
  return { command: slash(opts.execPath), args: ["run", "--cwd", slash(opts.repoRoot), "index.ts"], env };
}

/** `extra` son las claves que un cliente exige en la entrada ademas de command, args y env. */
type JsonTarget = { kind: "json"; path: string; rootKey: "mcpServers" | "servers"; extra?: Record<string, unknown> };
type TomlTarget = { kind: "toml"; path: string };
export type Target = JsonTarget | TomlTarget | { kind: "claude-code" };

/** Donde guarda cada cliente su configuracion de usuario. */
export function targetFor(id: ClientId, d: Dirs): Target {
  const appData = d.appData ?? join(d.home, "AppData", "Roaming");
  const support = d.platform === "win32" ? appData : d.platform === "darwin" ? join(d.home, "Library", "Application Support") : join(d.home, ".config");
  switch (id) {
    case "claude-code": return { kind: "claude-code" };
    case "claude-desktop": return { kind: "json", path: join(support, "Claude", "claude_desktop_config.json"), rootKey: "mcpServers" };
    case "vscode": return { kind: "json", path: join(support, "Code", "User", "mcp.json"), rootKey: "servers", extra: { type: "stdio" } };
    // Formato nativo de Copilot (CLI y VS Code): COPILOT_HOME o ~/.copilot. type "local" y tools "*" son los de su documentacion.
    case "copilot": return { kind: "json", path: join(d.copilotHome || join(d.home, ".copilot"), "mcp-config.json"), rootKey: "mcpServers", extra: { type: "local", tools: ["*"] } };
    case "cursor": return { kind: "json", path: join(d.home, ".cursor", "mcp.json"), rootKey: "mcpServers" };
    case "gemini": return { kind: "json", path: join(d.home, ".gemini", "settings.json"), rootKey: "mcpServers" };
    case "codex": return { kind: "toml", path: join(d.home, ".codex", "config.toml") };
  }
}

/** Un cliente se considera instalado si existe la carpeta donde guarda su configuracion. */
export function isInstalled(id: ClientId, d: Dirs, which: (cmd: string) => string | null): boolean {
  const t = targetFor(id, d);
  if (t.kind === "claude-code") return which("claude") !== null;
  // Para VS Code la carpeta de usuario es `Code/User`; en el resto basta la del archivo.
  return existsSync(dirname(t.path));
}

/** Devuelve el JSON con la entrada puesta (o quitada si `entry` es null). Lanza si el texto no es JSON. */
export function applyJson(text: string | undefined, rootKey: string, entry: Record<string, unknown> | null): string {
  let doc: Record<string, unknown> = {};
  if (text?.trim()) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("no es un objeto");
      doc = parsed as Record<string, unknown>;
    } catch (error) {
      // shortcut: JSON con comentarios (JSONC) no se edita; se avisa y no se toca el archivo.
      throw new Error(`el archivo existe pero no es JSON valido (${error instanceof Error ? error.message : error}); no se modifica`);
    }
  }
  const servers = { ...((doc[rootKey] as Record<string, unknown> | undefined) ?? {}) };
  if (entry) servers[SERVER_NAME] = entry;
  else delete servers[SERVER_NAME];
  return `${JSON.stringify({ ...doc, [rootKey]: servers }, null, 2)}\n`;
}

const BEGIN = "# >>> talend-mcp (gestionado por `talend-mcp setup`) >>>";
const END = "# <<< talend-mcp <<<";

/** Bloque delimitado en config.toml: se reemplaza entero, asi setup es idempotente. */
export function applyToml(text: string | undefined, launcher: Launcher | null): string {
  const current = text ?? "";
  const start = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  const without = start >= 0 && end > start ? `${current.slice(0, start)}${current.slice(end + END.length)}`.replace(/\n{3,}/g, "\n\n") : current;
  if (!launcher) return without.trim() ? `${without.trim()}\n` : "";
  const env = Object.entries(launcher.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("\n");
  const block = [BEGIN, `[mcp_servers.${SERVER_NAME}]`, `command = ${JSON.stringify(launcher.command)}`,
    `args = [${launcher.args.map((a) => JSON.stringify(a)).join(", ")}]`, "", `[mcp_servers.${SERVER_NAME}.env]`, env, END].join("\n");
  return `${without.trim() ? `${without.trim()}\n\n` : ""}${block}\n`;
}

export type Outcome = { client: ClientId; status: "applied" | "dry-run" | "skipped" | "error"; detail: string };

export type SetupDeps = {
  dirs: Dirs;
  which: (cmd: string) => string | null;
  run: (cmd: string[]) => { ok: boolean; output: string };
};

/** Aplica (launcher) o quita (null) la entrada en un cliente. */
export function configureClient(id: ClientId, launcher: Launcher | null, deps: SetupDeps, dryRun: boolean): Outcome {
  const target = targetFor(id, deps.dirs);
  try {
    if (target.kind === "claude-code") {
      const claude = deps.which("claude");
      if (!claude) return { client: id, status: "skipped", detail: "no se encontro el comando `claude`" };
      const add = launcher
        ? [claude, "mcp", "add-json", SERVER_NAME, JSON.stringify({ type: "stdio", command: launcher.command, args: launcher.args, env: launcher.env }), "--scope", "user"]
        : null;
      if (dryRun) return { client: id, status: "dry-run", detail: `claude mcp ${launcher ? "add-json" : "remove"} ${SERVER_NAME} --scope user` };
      // add-json falla si ya existe: se quita antes para que setup sea repetible y actualice.
      const removed = deps.run([claude, "mcp", "remove", SERVER_NAME, "--scope", "user"]);
      if (!add) return { client: id, status: removed.ok ? "applied" : "skipped", detail: removed.ok ? "quitado" : "no estaba registrado" };
      const added = deps.run(add);
      return { client: id, status: added.ok ? "applied" : "error", detail: added.ok ? "registrado (scope user)" : added.output.trim() };
    }

    const before = existsSync(target.path) ? readFileSync(target.path, "utf8") : undefined;
    const next = target.kind === "toml"
      ? applyToml(before, launcher)
      : applyJson(before, target.rootKey, launcher ? { ...target.extra, command: launcher.command, args: launcher.args, env: launcher.env } : null);
    if (before === undefined && !launcher) return { client: id, status: "skipped", detail: "no hay configuracion" };
    if (dryRun) return { client: id, status: "dry-run", detail: target.path };
    mkdirSync(dirname(target.path), { recursive: true });
    const backup = `${target.path}.bak-talend-mcp`;
    if (before !== undefined && !existsSync(backup)) copyFileSync(target.path, backup);
    writeFileSync(target.path, next, "utf8");
    return { client: id, status: "applied", detail: target.path };
  } catch (error) {
    return { client: id, status: "error", detail: error instanceof Error ? error.message : String(error) };
  }
}
