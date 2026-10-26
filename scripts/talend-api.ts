import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

import { createUi } from "../src/shared/cli/ui";
import { bridgeHome, bridgePort } from "./lib/bridge-hot-reload";
import { detectStudio } from "./lib/studio-detect";

/**
 * Examen de la API de Talend Studio que usa el bridge.
 *
 *   bun run scripts/talend-api.ts drift
 *       Busca en el codigo del bridge nombres de clase o de metodo que la
 *       instalacion de Studio no tiene (ver scripts/talend-api/ApiDrift.java).
 *
 *   bun run scripts/talend-api.ts find getNodeByUniqueName getListContext
 *       En que clases de org.talend se declara cada nombre.
 *
 *   bun run scripts/talend-api.ts live org.talend.core.model.process.IProcess2 \
 *       --member org.talend.core.model.process.IProcess#getUniqueName \
 *       --field org.talend.repository.ProjectManager#INSTANCE
 *       Pregunta al bridge que esta abierto en Studio (GET /talend/api/check).
 */

const ui = createUi();
const IS_WIN = platform() === "win32";
const PROJECT_ROOT = join(import.meta.dir, "..");
const DRIFT_SOURCE = join(PROJECT_ROOT, "scripts", "talend-api", "ApiDrift.java");
const BRIDGE_SOURCE = join(PROJECT_ROOT, "talend-studio-bridge", "com.andres.talend.bridge", "src");

export type MemberSpec = { class: string; name: string; kind: "method" | "field" };

export type TalendApiCommand =
  | { command: "help" }
  | { command: "drift" }
  | { command: "find"; names: string[] }
  | { command: "live"; classes: string[]; members: MemberSpec[] }
  | { command: "error"; message: string };

/** Separa `org.x.Clase#nombre` en clase y nombre. Null si la forma no es esa. */
export function splitMember(spec: string): { class: string; name: string } | null {
  const index = spec.lastIndexOf("#");
  if (index <= 0 || index === spec.length - 1) return null;
  return { class: spec.slice(0, index), name: spec.slice(index + 1) };
}

/** Interpreta la linea de comandos. Sin efectos: solo decide que hacer. */
export function parseTalendApiArgs(argv: string[]): TalendApiCommand {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return { command: "help" };
    case "drift":
      return { command: "drift" };
    case "find":
      return rest.length > 0
        ? { command: "find", names: rest }
        : { command: "error", message: "find necesita al menos un nombre" };
    case "live": {
      const classes: string[] = [];
      const members: MemberSpec[] = [];
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i]!;
        if (arg === "--member" || arg === "--field") {
          const parsed = rest[++i] !== undefined ? splitMember(rest[i]!) : null;
          if (!parsed) return { command: "error", message: `${arg} necesita Clase#nombre` };
          members.push({ ...parsed, kind: arg === "--field" ? "field" : "method" });
        } else {
          classes.push(arg);
        }
      }
      if (classes.length === 0 && members.length === 0) {
        return { command: "error", message: "live necesita clases o --member/--field" };
      }
      return { command: "live", classes, members };
    }
    default:
      return { command: "error", message: `comando desconocido: ${command}` };
  }
}

function javaExecutable(jdk: string): string {
  return join(jdk, "bin", IS_WIN ? "java.exe" : "java");
}

/** Ejecuta el detector de Java contra la instalacion de Studio que haya. */
function runDetector(extraArgs: string[]): number {
  const studio = detectStudio();
  if (!studio) {
    ui.fail("No se encontro Talend Studio. Define TALEND_STUDIO_HOME.");
    return 1;
  }
  const plugins = join(studio.studioDir, "plugins");
  const result = spawnSync(javaExecutable(studio.jdk), [DRIFT_SOURCE, plugins, ...extraArgs], {
    stdio: "inherit",
  });
  return result.status ?? 1;
}

async function runLive(classes: string[], members: MemberSpec[]): Promise<number> {
  const token = process.env.TALEND_BRIDGE_TOKEN
    ? readFileSync(process.env.TALEND_BRIDGE_TOKEN, "utf8").trim()
    : existsSync(join(bridgeHome(), "token"))
      ? readFileSync(join(bridgeHome(), "token"), "utf8").trim()
      : "";
  const url = `http://127.0.0.1:${bridgePort()}/talend/api/check`;
  let payload: {
    classes?: { name: string; available: boolean; loadedFromBundle?: string | null }[];
    members?: { class: string; name: string; kind: string; available: boolean; declaredIn?: string | null }[];
    error?: { message: string };
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classes, members }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    ui.fail(`No se pudo consultar el bridge en ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (response.status === 404) {
    // El servidor HTTP responde 404 en HTML: la version del plugin no tiene esta ruta.
    ui.fail("El bridge en marcha no tiene /talend/api/check: su version es anterior. Ejecuta --install-bridge.");
    return 1;
  }
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    ui.fail(`El bridge respondio ${response.status} sin JSON.`);
    return 1;
  }
  if (!response.ok) {
    ui.fail(`El bridge respondio ${response.status}: ${payload.error?.message ?? "sin detalle"}`);
    return 1;
  }

  let missing = 0;
  for (const item of payload.classes ?? []) {
    if (!item.available) missing++;
    const mark = item.available ? "✓" : "✖";
    ui.line(`  ${mark} clase ${item.name}${item.available && item.loadedFromBundle ? `  (${item.loadedFromBundle})` : ""}`);
  }
  for (const item of payload.members ?? []) {
    if (!item.available) missing++;
    const mark = item.available ? "✓" : "✖";
    const where = item.available && item.declaredIn ? `  (${item.declaredIn})` : "";
    ui.line(`  ${mark} ${item.kind} ${item.class}#${item.name}${where}`);
  }
  return missing === 0 ? 0 : 1;
}

const HELP = `Uso:
  bun run scripts/talend-api.ts drift
  bun run scripts/talend-api.ts find <nombre> [<nombre>...]
  bun run scripts/talend-api.ts live <clase>... [--member Clase#metodo] [--field Clase#CAMPO]`;

export async function runTalendApi(argv: string[]): Promise<number> {
  const parsed = parseTalendApiArgs(argv);
  switch (parsed.command) {
    case "help":
      ui.line(HELP);
      return 0;
    case "error":
      ui.fail(parsed.message);
      ui.line(HELP);
      return 2;
    case "drift":
      return runDetector([BRIDGE_SOURCE]);
    case "find":
      return runDetector(["--find", ...parsed.names]);
    case "live":
      return await runLive(parsed.classes, parsed.members);
  }
}

if (import.meta.main) {
  process.exitCode = await runTalendApi(process.argv.slice(2));
}
