import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "url";

import { createStyler, createUi, shouldUseColor, type UiTone } from "../src/shared/cli/ui";
import { detectStudio, runJavaVersion, studioHomeCandidates } from "./lib/studio-detect";
import { compileFast, compileWithMaven, type Compiled } from "./lib/bridge-compile";
import {
  isStudioRunning,
  publishHotJar,
  runningBridgeVersion,
  waitForHotReload,
} from "./lib/bridge-hot-reload";
import {
  cleanLeftoverJars,
  cleanMalformedP2Repositories,
  cleanStaleP2Repositories,
  installNew,
  installedFeatureVersion,
  prepareWorkspace,
  uninstallPrevious,
} from "./lib/p2-install";

/**
 * Instalador del plugin Java del bridge (Talend Studio Bridge).
 *
 * Todo el proceso se hace por CLI:
 *   1. Detecta la instalacion de Talend Studio y su JDK.
 *   2. Compila el plugin: con javac si Studio esta abierto (carga en caliente)
 *      o con Maven + Tycho cuando hay que generar el update site de p2.
 *   3. Publica el jar en la carpeta de carga en caliente o, con Studio cerrado,
 *      desinstala la version anterior e instala la nueva con el p2 director.
 *
 * Se ejecuta desde `bun run scripts/start.ts --install-bridge`.
 */

const ui = createUi();
const ok = (message: string): void => ui.ok(message);
const info = (message: string): void => ui.info(message);
const warn = (message: string): void => ui.warn(message);
const fail = (message: string): void => ui.fail(message);
const step = (message: string): void => ui.step(message);

/** Resalta rutas y versiones dentro de una linea. */
const c = createStyler(shouldUseColor(process.env, Boolean(process.stderr.isTTY)));

function separador(): void {
  ui.separator();
}

function banner(titulo: string, lineas: string[], tone: UiTone = "neutral"): void {
  ui.banner(titulo, lineas, tone);
}


export type InstallBridgeOptions = {
  /**
   * Modo arranque: sin banner, sin `exitCode` y sin p2. Solo compila y publica
   * el jar si Studio esta abierto, que es la ruta rapida y sin reinicio. Si no
   * hay nada que hacer, no imprime nada.
   */
  auto?: boolean;
};

export async function installBridge(options: InstallBridgeOptions = {}): Promise<void> {
  const auto = options.auto === true;
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const flags = new Set(process.argv.slice(2));
  const useMaven = flags.has("--maven");
  const force = flags.has("--force") && !auto;

  if (!auto) {
    banner("Talend Studio Bridge", [
      `  ${c("Compila el plugin y lo instala (o actualiza) en Talend Studio.", "dim")}`,
    ]);
    step("Detectando Talend Studio...");
  }

  const studio = detectStudio();
  if (!studio) {
    if (auto) {
      ui.debug("Plugin: no se detecto Talend Studio; se omite la actualizacion automatica.");
      return;
    }
    fail("No se encontro una instalacion de Talend Studio con su JDK.");
    ui.line();
    ui.line("  Define TALEND_STUDIO_HOME con la carpeta que contiene plugins/ y features/:");
    ui.line(`    ${c("TALEND_STUDIO_HOME=C:/Talend/8.0.1/studio", "dim")}`);
    ui.line("  Rutas revisadas:");
    for (const candidate of [...new Set(studioHomeCandidates())].slice(0, 8)) {
      ui.line(`  - ${candidate}`);
    }
    ui.line();
    process.exitCode = 1;
    return;
  }

  const studioRunning = await isStudioRunning(studio);

  if (auto && !studioRunning) {
    ui.debug(`Plugin: Studio cerrado; se omite la instalacion en ${studio.studioDir}.`);
    return;
  }

  if (!auto) {
    ok(`Talend Studio: ${c(studio.studioDir, "cyan")}`);
    ok(`Ejecutable: ${c(basename(studio.exe), "cyan")}`);
    ok(`JDK: ${c(studio.jdk, "cyan")} (Java ${runJavaVersion(studio.jdk)})`);
    if (studioRunning) {
      info("Talend Studio esta corriendo: se usara carga en caliente (sin reiniciar).");
    }
    separador();
  }
  // Con Studio abierto solo hace falta el jar: se compila con javac. Maven
  // queda para el update site de p2 (Studio cerrado) y como respaldo.
  let compiled: Compiled | null;
  if (studioRunning && !useMaven) {
    const fast = compileFast(projectRoot, studio.jdk, force);
    if (fast === "fallback" && auto) {
      warn("Plugin: la compilacion rapida no esta disponible y no se ejecuta Maven en el arranque.");
      return;
    }
    compiled = fast === "fallback" ? compileWithMaven(projectRoot, studio.jdk) : fast;
  } else {
    compiled = compileWithMaven(projectRoot, studio.jdk);
  }
  if (!compiled) {
    if (!auto) process.exitCode = 1;
    return;
  }
  const jar = compiled.jar;

  // Nada que recargar: las fuentes no cambiaron y Studio ya sirve esta version.
  if (studioRunning && compiled.reused && compiled.version && !force) {
    if ((await runningBridgeVersion()) === compiled.version) {
      if (auto) {
        ui.debug(`Plugin: ya esta actualizado (${compiled.version}).`);
      } else {
        separador();
        ok("El bridge ya esta actualizado: no hay nada que recargar.");
      }
      return;
    }
  }

  // ── Carga en caliente ─────────────────────────────────────────────────────
  // El plugin instalado vigila ~/.talend-bridge/hot/bridge.jar y se recarga
  // solo cuando el archivo cambia. No requiere reiniciar Talend Studio.
  if (!auto) separador();
  step("Publicando el bundle para carga en caliente...");
  const hotJar = publishHotJar(jar);
  if (hotJar) {
    ok(`Bundle publicado en ${c(hotJar, "cyan")}`);
  }

  if (studioRunning) {
    const reloaded = await waitForHotReload(compiled.version, auto ? 12_000 : 30_000);
    if (auto) {
      if (reloaded) ok("Plugin actualizado en caliente.");
      else warn("Plugin publicado; el bridge lo recargara en los proximos segundos.");
      return;
    }
    separador();
    banner(reloaded ? "Actualizacion en caliente completada" : "Bundle publicado", [
      `  ${c("Plugin:", "dim")} com.andres.talend.bridge`,
      reloaded
        ? `  ${c("Estado:", "dim")} ${c("recargado en caliente, sin reiniciar Studio", "green")}`
        : `  ${c("Estado:", "dim")} ${c("el plugin lo detectara en los proximos segundos", "yellow")}`,
      ``,
      `  ${c("El bridge sigue escuchando en http://127.0.0.1:3930", "dim")}`,
    ], reloaded ? "success" : "warning");
    return;
  }

  // ── Instalacion con p2 (Studio cerrado) ──────────────────────────────────
  const repoDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge.repository", "target", "repository");
  if (!existsSync(repoDir)) {
    fail(`No se encontro el update site en ${repoDir}`);
    process.exitCode = 1;
    return;
  }

  separador();
  step("Actualizando el plugin en Talend Studio...");

  const previous = installedFeatureVersion(studio);
  if (previous) {
    info(`Version instalada actualmente: ${c(previous, "yellow")}`);
  }

  const workspace = prepareWorkspace(repoDir);

  try {
    cleanLeftoverJars(studio);
    cleanStaleP2Repositories(studio);
    cleanMalformedP2Repositories(studio);
    uninstallPrevious(studio, workspace.data);

    if (!installNew(studio, workspace.repo, workspace.data)) {
      fail("La instalacion del plugin fallo.");
      process.exitCode = 1;
      return;
    }
  } finally {
    workspace.cleanup();
  }

  const installed = installedFeatureVersion(studio);

  separador();
  banner("Instalacion completada", [
    `  ${c("Plugin:", "dim")} com.andres.talend.bridge`,
    `  ${c("Version instalada:", "dim")} ${c(installed ?? "desconocida", "green")}`,
    previous ? `  ${c("Version anterior:", "dim")} ${c(previous, "yellow")}` : "",
    ``,
    `  ${c("El bridge queda escuchando en http://127.0.0.1:3930", "dim")}`,
    `  ${c("El token esta en ~/.talend-bridge/token", "dim")}`,
  ].filter(Boolean), "success");
}
