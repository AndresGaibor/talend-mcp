import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getAllRuntimeTools, knownPresets } from "../src/server/registered-tools";
import { applyFilter } from "../src/server/registered-tools/presets";
import { runningBridgePing } from "./lib/bridge-hot-reload";

/**
 * Mapa vivo del repo para quien llega nuevo: que hay en cada carpeta, cuantas tools
 * expone cada preset, que comandos existen y en que estado esta el bridge.
 *
 *   bun run mapa          -> texto para leer
 *   bun run mapa --json   -> lo mismo en JSON (para scripts y agentes)
 *
 * Todo sale del codigo en el momento de ejecutarlo: no hay cifras escritas a mano.
 */

const ROOT = join(import.meta.dir, "..");

/**
 * Que es cada carpeta de primer nivel. Si aparece una carpeta nueva sin descripcion,
 * `tests/scripts/mapa.test.ts` falla: documentarla es parte de agregarla.
 */
export const DESCRIPCION_DE_CARPETAS: Record<string, string> = {
  "src": "Servidor MCP: nucleo, modulos, presentacion, dominio Talend y registro de tools.",
  "scripts": "Operacion: arranque, instalacion del plugin, diagnostico, arnes L5, CLI de jobs.",
  "tests": "Suite de bun test. Solo corre lo que esta aqui (bunfig.toml).",
  "talend-studio-bridge": "Plugin Java/Eclipse que corre dentro de Talend Studio y expone su API por HTTP.",
  "docs": "Documentacion tecnica. Empieza por docs/README.md.",
  "logs": "Logs locales generados durante la ejecucion del MCP; ignorados por git.",
  "addons": "Datos de sinonimos sin uso confirmado en el codigo. No borrar sin revisar.",
  "examples": "Ejemplos de entrada (perfiles de tarea y contextos).",
  "testdata": "Datos de prueba que generan los scripts; los grandes no se versionan.",
  "workspace": "Workspace local de Talend Studio (Eclipse). Ignorado por git: no lo edites.",
  "node_modules": "Dependencias de bun install. Ignorado por git.",
};

function carpetasDeNivelUno(): string[] {
  return readdirSync(ROOT)
    .filter((name) => !name.startsWith(".") && statSync(join(ROOT, name)).isDirectory())
    .sort();
}

function contar(dir: string, pattern: RegExp): number {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return 0;
  let total = 0;
  const visit = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules") continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (pattern.test(entry)) total++;
    }
  };
  visit(absolute);
  return total;
}

async function leerPaquete(): Promise<string[]> {
  const pkg = (await Bun.file(join(ROOT, "package.json")).json()) as { scripts?: Record<string, string> };
  return Object.keys(pkg.scripts ?? {}).sort();
}

function ramaYCommit(): { rama: string; commit: string } {
  const rama = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  const commit = spawnSync("git", ["log", "-1", "--format=%h %s"], { cwd: ROOT, encoding: "utf8" });
  return {
    rama: rama.status === 0 ? rama.stdout.trim() : "sin git",
    commit: commit.status === 0 ? commit.stdout.trim() : "",
  };
}

export async function construirMapa() {
  const tools = getAllRuntimeTools();
  const presets = Object.fromEntries(
    knownPresets().map((preset) => [preset, applyFilter(tools, preset).length]),
  );
  const ping = await runningBridgePing();
  const { rama, commit } = ramaYCommit();
  return {
    repo: { rama, commit },
    carpetas: carpetasDeNivelUno().map((nombre) => ({
      nombre,
      descripcion: DESCRIPCION_DE_CARPETAS[nombre] ?? "(sin descripcion: documentala en scripts/mapa.ts)",
    })),
    tools: { total: tools.length, presets },
    pruebas: {
      archivos: contar("tests", /\.test\.ts$/),
      escenariosL5: contar("tests/fixtures/talend/escenarios-l5", /\.json$/),
    },
    comandos: await leerPaquete(),
    bridge: ping
      ? { estado: "responde", version: ping.version, modo: ping.mode ?? "desconocido" }
      : { estado: "no responde", version: null, modo: null },
  };
}

function imprimirTexto(mapa: Awaited<ReturnType<typeof construirMapa>>): void {
  const lineas: string[] = [];
  lineas.push("Mapa de talend-mcp");
  lineas.push(`  rama: ${mapa.repo.rama}   ultimo commit: ${mapa.repo.commit || "-"}`);
  lineas.push("");
  lineas.push("Carpetas");
  for (const { nombre, descripcion } of mapa.carpetas) {
    lineas.push(`  ${nombre.padEnd(22)} ${descripcion}`);
  }
  lineas.push("");
  lineas.push(`Tools MCP (${mapa.tools.total} en total). Por preset (TALEND_MCP_FILTER):`);
  for (const [preset, count] of Object.entries(mapa.tools.presets)) {
    lineas.push(`  ${preset.padEnd(14)} ${count}`);
  }
  lineas.push("  bun run start usa `agent` por defecto; start:server y el arranque sin variable exponen todas.");
  lineas.push("");
  lineas.push(`Pruebas: ${mapa.pruebas.archivos} archivos de test, ${mapa.pruebas.escenariosL5} escenarios L5.`);
  lineas.push("");
  lineas.push(`Bridge de Studio: ${mapa.bridge.estado}${mapa.bridge.version ? ` (${mapa.bridge.version}, ${mapa.bridge.modo})` : ""}`);
  lineas.push("");
  lineas.push("Comandos (bun run <nombre>)");
  lineas.push(`  ${mapa.comandos.join("  ")}`);
  console.log(lineas.join("\n"));
}

if (import.meta.main) {
  const mapa = await construirMapa();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(mapa, null, 2));
  } else {
    imprimirTexto(mapa);
  }
}
