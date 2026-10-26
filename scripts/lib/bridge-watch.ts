import { watch } from "node:fs";
import { join } from "node:path";

import { createUi, formatDuration } from "../../src/shared/cli/ui";
import { compileFast } from "./bridge-compile";
import { publishHotJar, runningBridgePing, runningBridgeVersion, waitForHotReload } from "./bridge-hot-reload";
import type { StudioInstall } from "./studio-detect";

/**
 * Ciclo de desarrollo del plugin: al guardar un fuente del bundle se compila con
 * javac, se publica el jar y Talend Studio recarga el bridge sin reiniciarse.
 *
 * Es el mismo camino que `--install-bridge` con Studio abierto, pero sin volver a
 * lanzar el instalador por cada cambio. Requiere que el bridge ya responda.
 */

const ui = createUi();

/** Espera este tiempo tras el ultimo cambio: los editores guardan en rafagas. */
const DEBOUNCE_MS = 400;
const RELOAD_TIMEOUT_MS = 20_000;

/** Solo los cambios que entran en el jar disparan una compilacion. */
export function isBundleSourceChange(filename: string | null): boolean {
  if (!filename) return false;
  const path = filename.replace(/\\/g, "/");
  if (/(^|\/)(target|bin|\.settings)(\/|$)/.test(path)) return false;
  if (/(\.swp|\.tmp|\.bak)$/i.test(path) || path.endsWith("~")) return false;
  return path.startsWith("src/") || path.startsWith("META-INF/") || path === "plugin.xml";
}

/** Vigila el bundle y recompila y recarga en cada cambio. Sigue hasta Ctrl+C. */
export async function runBridgeWatch(projectRoot: string, studio: StudioInstall | null): Promise<number> {
  if (!studio) {
    ui.fail("No se encontro Talend Studio. Define TALEND_STUDIO_HOME.");
    return 1;
  }
  if (!(await runningBridgePing())) {
    ui.fail("El bridge no responde: abre Talend Studio primero, o ejecuta --install-bridge con Studio cerrado.");
    return 1;
  }

  const bundleDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let again = false;

  const cycle = async (): Promise<void> => {
    if (running) {
      // Un cambio llego durante una compilacion: se repite al terminar.
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await rebuildAndReload(projectRoot, studio.jdk);
      } while (again);
    } finally {
      running = false;
    }
  };

  // Se vigila antes del primer ciclo: un guardado durante la compilacion inicial no se pierde.
  const watcher = watch(bundleDir, { recursive: true }, (_event, filename) => {
    if (!isBundleSourceChange(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => void cycle(), DEBOUNCE_MS);
  });

  ui.ok(`Vigilando ${bundleDir}`);
  ui.info("Guarda un fuente para recargar el bridge. Ctrl+C para salir.");

  // Estado inicial: si el build local ya esta cargado en el bridge, no hace nada.
  await cycle();

  process.once("SIGINT", () => {
    clearTimeout(timer);
    watcher.close();
    ui.line();
    ui.info("Vigilancia detenida.");
    process.exit(0);
  });
  return 0;
}

async function rebuildAndReload(projectRoot: string, jdk: string): Promise<void> {
  const started = Date.now();
  const compiled = compileFast(projectRoot, jdk, false);

  if (compiled === "fallback") {
    ui.fail("La compilacion rapida no esta disponible. Ejecuta --install-bridge una vez para preparar el target platform.");
    return;
  }
  if (!compiled) return; // El error de javac ya se mostro; se sigue vigilando.

  // Sin cambios reales en el jar: solo hace falta recargar si el bridge no lo tiene.
  if (compiled.reused && compiled.version && (await runningBridgeVersion()) === compiled.version) return;

  const published = publishHotJar(compiled.jar);
  if (!published) return;

  const reloaded = await waitForHotReload(compiled.version, RELOAD_TIMEOUT_MS);
  if (reloaded) {
    ui.info(`Ciclo completo en ${formatDuration(Date.now() - started)}.`);
  }
}
