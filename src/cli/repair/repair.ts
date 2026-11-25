import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { detectStudio, safeReaddir, type StudioInstall } from "../../../scripts/lib/studio-detect";
import { installedFeatureVersion } from "../../../scripts/lib/p2-install";
import { isStudioRunning, runningBridgeVersion } from "../../../scripts/lib/bridge-hot-reload";
import { createStyler, createUi, shouldUseColor } from "../../shared/cli/ui";
import { runBridgeCommand } from "../bridge-command";
import { planSafeConfig } from "./config";
import { clearHotJar } from "./hot-jar";
import { removeSupervisorTask, stopSupervisorProcesses, supervisorTaskInstalled } from "./supervisor";

/**
 * `talend-mcp repair`: deja Studio en un estado seguro y al dia.
 *
 * Arregla las tres cosas que pueden hacer que Studio cierre ventanas solo:
 *  1. `autoDismissModals` activo en `~/.talend-bridge/config.json`.
 *  2. El supervisor que pulsaba dialogos cada 5 s (`TalendMcpSupervisor`).
 *  3. Un plugin viejo o incompleto instalado en Studio (p2) o un jar de carga en caliente anterior.
 *
 * Es idempotente. Con Studio abierto actualiza el plugin en marcha y avisa de que p2 necesita que se cierre;
 * con Studio cerrado deja la instalacion completa.
 */

const c = createStyler(shouldUseColor(process.env, Boolean(process.stderr.isTTY)));
const ui = createUi();

export type RepairReporter = {
  step: (message: string) => void;
  ok: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  fail: (message: string) => void;
};

export type RepairDeps = {
  home: string;
  detectStudio: () => StudioInstall | null;
  isStudioRunning: (studio: StudioInstall) => Promise<boolean>;
  installedFeature: (studio: StudioInstall) => string | null;
  installedJar: (studio: StudioInstall) => string | null;
  installPlugin: (options: { from?: string; dryRun: boolean }) => Promise<number>;
  runningVersion: () => Promise<string | null>;
  readConfig: (path: string) => string | null;
  writeConfig: (path: string, text: string) => void;
  supervisorInstalled: () => boolean;
  removeSupervisor: () => boolean;
  stopSupervisor: () => number;
  clearHotJar: () => boolean;
  report: RepairReporter;
};

export type RepairOptions = {
  dryRun?: boolean;
  from?: string;
  /** No quitar la tarea que mantiene vivo el MCP (la pulsacion de dialogos ya esta apagada por defecto). */
  keepSupervisor?: boolean;
};

export type RepairResult = {
  ok: boolean;
  pendingStudioRestart: boolean;
  installed: string | null;
  running: string | null;
  actions: string[];
};

/** Version del jar del plugin instalado en `plugins/`, o null si el feature quedo sin su bundle. */
export function pluginJarVersion(studio: StudioInstall): string | null {
  const name = safeReaddir(join(studio.studioDir, "plugins")).find(
    (entry) => entry.startsWith("com.andres.talend.bridge_") && entry.endsWith(".jar"),
  );
  if (!name) return null;
  return name.match(/_(\d+\.\d+\.\d+\.\d+)\.jar$/)?.[1] ?? name;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

export const defaultRepairDeps: RepairDeps = {
  home: homedir(),
  detectStudio,
  isStudioRunning,
  installedFeature: installedFeatureVersion,
  installedJar: pluginJarVersion,
  installPlugin: ({ from, dryRun }) => runBridgeCommand({ action: "install", from, dryRun }),
  runningVersion: runningBridgeVersion,
  readConfig: readText,
  writeConfig: writeText,
  supervisorInstalled: supervisorTaskInstalled,
  removeSupervisor: removeSupervisorTask,
  stopSupervisor: stopSupervisorProcesses,
  clearHotJar,
  report: { step: ui.step, ok: ui.ok, info: ui.info, warn: ui.warn, fail: ui.fail },
};

/**
 * Ejecuta la reparacion. Separado de la CLI para poder probar cada decision sin tocar Studio.
 */
export async function repair(deps: RepairDeps, opts: RepairOptions = {}): Promise<RepairResult> {
  const dryRun = opts.dryRun === true;
  const actions: string[] = [];
  let hardFailure = false;
  const modales = process.env.TALEND_MODALS_AUTO;
  if (modales === "1" || modales === "true") {
    deps.report.warn(
      "TALEND_MODALS_AUTO=1 mantiene activa la pulsacion automatica de dialogos. " +
        "Quita esa variable del entorno si no la quieres.",
    );
  }

  // 1. Configuracion del plugin: ningun guardian que cierre o guarde ventanas por su cuenta.
  const configPath = join(deps.home, ".talend-bridge", "config.json");
  const before = deps.readConfig(configPath);
  const planned = planSafeConfig(before);
  if (planned.error) {
    deps.report.warn(
      `No se pudo leer ${configPath}: ${planned.error}. El plugin usa autoDismissModals=false por defecto.`,
    );
  } else if (planned.changed) {
    if (dryRun) {
      deps.report.info(`Simulacion: se pondria autoDismissModals=false en ${configPath}.`);
    } else {
      try {
        deps.writeConfig(configPath, planned.text!);
        actions.push("config");
        deps.report.ok(`Dialogos automaticos apagados en ${configPath}.`);
      } catch (error) {
        deps.report.fail(
          `No se pudo escribir ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
        hardFailure = true;
      }
    }
  } else {
    deps.report.info(`La configuracion ya tiene autoDismissModals=false (${configPath}).`);
  }

  // 2. Supervisor: era el otro sitio que pulsaba botones cada 5 s.
  if (opts.keepSupervisor) {
    deps.report.info("Se conserva el supervisor (--keep-supervisor).");
  } else {
    const installed = deps.supervisorInstalled();
    if (dryRun) {
      deps.report.info(
        installed
          ? "Simulacion: se quitaria la tarea TalendMcpSupervisor y se detendria un supervisor en marcha."
          : "Simulacion: no hay tarea de supervisor que quitar; se detendria uno en marcha si lo hubiera.",
      );
    } else {
      const stopped = deps.stopSupervisor();
      if (installed) {
        if (deps.removeSupervisor()) {
          actions.push("supervisor");
          deps.report.ok("Tarea TalendMcpSupervisor eliminada: ya no se contestan dialogos solos.");
        } else {
          deps.report.warn(
            "No se pudo eliminar la tarea TalendMcpSupervisor. Quitala con: " +
              "schtasks /Delete /TN TalendMcpSupervisor /F",
          );
        }
      } else if (stopped === 0) {
        deps.report.info("No hay supervisor automatico en marcha.");
      }
      if (stopped > 0) deps.report.ok(`Supervisor detenido (${stopped} proceso(s)).`);
    }
  }

  // 3. Plugin de Studio: version instalada, jar presente y sincronizacion con lo que esta en marcha.
  const studio = deps.detectStudio();
  if (!studio) {
    deps.report.info("No se detecto Talend Studio: no hay plugin que actualizar.");
    deps.report.info("Si esta en otra ruta, define TALEND_STUDIO_HOME y repite.");
    return finish(
      deps,
      { ok: !hardFailure, pendingStudioRestart: false, installed: null, running: null, actions },
      dryRun,
    );
  }

  const runningBefore = await deps.isStudioRunning(studio);
  const featureBefore = deps.installedFeature(studio);
  const jarBefore = deps.installedJar(studio);
  deps.report.step(`Talend Studio: ${studio.studioDir}`);
  deps.report.info(
    featureBefore
      ? `Plugin instalado: ${featureBefore}${jarBefore ? ` (jar ${jarBefore})` : " (sin el jar del plugin)"}.`
      : "El plugin no esta instalado en este Studio.",
  );
  deps.report.info(
    runningBefore
      ? "Studio esta abierto: se actualiza el plugin en marcha; p2 necesita Studio cerrado."
      : "Studio esta cerrado: la instalacion se puede reparar con p2.",
  );

  const code = await deps.installPlugin({ from: opts.from, dryRun });
  if (code !== 0) {
    deps.report.fail("No se pudo actualizar el plugin de Studio.");
    hardFailure = true;
  }

  const featureAfter = deps.installedFeature(studio);
  const jarAfter = deps.installedJar(studio);
  const runningAfter = await deps.runningVersion();

  let pendingStudioRestart = false;

  if (dryRun) {
    deps.report.info("Simulacion: no se modifico el plugin.");
  } else if (code === 0 && !runningBefore) {
    if (featureAfter && jarAfter) {
      actions.push("plugin");
      deps.report.ok(`Plugin instalado en Studio: ${featureAfter}.`);
      if (featureAfter !== jarAfter) {
        deps.report.warn(`La feature dice ${featureAfter} y el jar dice ${jarAfter}; revisa la instalacion.`);
      }
      if (deps.clearHotJar()) {
        deps.report.info("Se borro el jar de carga en caliente anterior para que Studio arranque con lo instalado.");
      }
    } else {
      deps.report.fail("El plugin no quedo completo: falta el jar o la feature en la instalacion de Studio.");
      deps.report.info("Ejecuta `talend-mcp bridge install` y revisa la salida de p2.");
      hardFailure = true;
    }
  } else if (code === 0) {
    // Studio abierto: la carga en caliente puede dejar el plugin en marcha mas nuevo que el instalado.
    if (runningAfter && featureAfter && runningAfter !== featureAfter) {
      pendingStudioRestart = true;
      deps.report.warn(
        `El plugin en marcha es ${runningAfter}, pero la copia instalada sigue en ${featureAfter}.`,
      );
      deps.report.info("Cierra Talend Studio y ejecuta `talend-mcp repair` otra vez para dejarla al dia.");
    } else if (!runningAfter) {
      pendingStudioRestart = true;
      deps.report.warn("El bridge no responde: no se pudo confirmar la version en marcha.");
      deps.report.info("Cierra Talend Studio y ejecuta `talend-mcp repair` para dejar la instalacion al dia.");
    } else {
      deps.report.ok(`Plugin ${runningAfter} al dia.`);
    }
  }

  return finish(
    deps,
    {
      ok: !hardFailure,
      pendingStudioRestart,
      installed: featureAfter,
      running: runningAfter,
      actions,
    },
    dryRun,
  );
}

function finish(deps: RepairDeps, result: RepairResult, dryRun: boolean): RepairResult {
  if (!result.ok) {
    deps.report.fail("La reparacion no termino. Revisa los mensajes anteriores.");
  } else if (result.pendingStudioRestart) {
    deps.report.warn("Queda un paso: cierra Talend Studio y ejecuta `talend-mcp repair` otra vez.");
  } else if (result.actions.length === 0) {
    deps.report.ok(dryRun ? "Simulacion completada: no se escribio nada." : "No habia nada que reparar.");
  } else {
    deps.report.ok(`Reparacion completada (${result.actions.join(", ")}).`);
  }
  if (result.installed || result.running) {
    deps.report.info(
      `Estado: ${c("instalado", "dim")}=${result.installed ?? "ninguno"} ` +
        `${c("en marcha", "dim")}=${result.running ?? "no responde"}`,
    );
  }
  return result;
}
