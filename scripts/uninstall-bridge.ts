import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStyler, createUi, shouldUseColor } from "../src/shared/cli/ui";
import { isStudioRunning } from "./lib/bridge-hot-reload";
import { cleanLeftoverJars, installedFeatureVersion, uninstallFeature } from "./lib/p2-install";
import { detectStudio, type StudioInstall } from "./lib/studio-detect";

/**
 * Desinstalador del plugin Java del bridge.
 *
 * Lo que borra `uninstall.ps1`/`uninstall.sh` son los datos locales; el plugin vive dentro de
 * Talend Studio y se quita con el p2 director. p2 no puede modificar la instalacion con Studio
 * abierto, asi que se pide cerrarlo en lugar de intentarlo a medias.
 *
 * Se ejecuta desde `talend-mcp bridge uninstall` y desde los desinstaladores.
 */

const ui = createUi();
const ok = (message: string): void => ui.ok(message);
const info = (message: string): void => ui.info(message);
const fail = (message: string): void => ui.fail(message);
const step = (message: string): void => ui.step(message);
const c = createStyler(shouldUseColor(process.env, Boolean(process.stderr.isTTY)));

export type BridgeUninstallState = {
  /** Version instalada en Studio, o null si el plugin no esta. */
  installed: string | null;
  studioRunning: boolean;
  dryRun: boolean;
};

export type BridgeUninstallPlan = {
  action: "nada" | "simular" | "cerrar-studio" | "quitar";
  version: string | null;
};

/** Decide que hacer con el plugin sin tocar Studio. Separado para poder probarlo. */
export function planBridgeUninstall(state: BridgeUninstallState): BridgeUninstallPlan {
  if (!state.installed) return { action: "nada", version: null };
  if (state.dryRun) return { action: "simular", version: state.installed };
  if (state.studioRunning) return { action: "cerrar-studio", version: state.installed };
  return { action: "quitar", version: state.installed };
}

export type UninstallBridgeOptions = {
  dryRun?: boolean;
  /** Solo para pruebas: sustituye la deteccion de Studio. */
  studio?: StudioInstall | null;
  /** Solo para pruebas: sustituye `isStudioRunning`. */
  isRunning?: (studio: StudioInstall) => Promise<boolean>;
  /** Solo para pruebas: sustituye la version instalada. */
  installedVersion?: (studio: StudioInstall) => string | null;
  /** Solo para pruebas: sustituye la desinstalacion con p2. */
  remove?: (studio: StudioInstall, data: string) => boolean;
};

export async function uninstallBridge(options: UninstallBridgeOptions = {}): Promise<void> {
  const dryRun = options.dryRun === true;
  const studio = options.studio === undefined ? detectStudio() : options.studio;

  if (!studio) {
    fail("No se encontro una instalacion de Talend Studio con su JDK.");
    ui.line("  Define TALEND_STUDIO_HOME con la carpeta que contiene plugins/ y features/:");
    ui.line(`    ${c("TALEND_STUDIO_HOME=C:/Talend/8.0.1/studio", "dim")}`);
    process.exitCode = 1;
    return;
  }

  const installed = (options.installedVersion ?? installedFeatureVersion)(studio);
  const studioRunning = await (options.isRunning ?? isStudioRunning)(studio);
  const plan = planBridgeUninstall({ installed, studioRunning, dryRun });

  if (plan.action === "nada") {
    ok("El plugin del bridge no esta instalado en este Studio: no hay nada que quitar.");
    return;
  }
  if (plan.action === "simular") {
    info(
      `Simulacion: se quitaria ${c(plan.version ?? "", "cyan")} de ${c(studio.studioDir, "cyan")} ` +
        "con el director de p2 (Studio cerrado).",
    );
    return;
  }
  if (plan.action === "cerrar-studio") {
    fail("Talend Studio esta abierto: p2 no puede desinstalar el plugin con Studio corriendo.");
    info("Cierra Talend Studio y vuelve a ejecutar `talend-mcp bridge uninstall`.");
    process.exitCode = 1;
    return;
  }

  step(`Quitando el plugin ${c(plan.version ?? "", "cyan")} de Talend Studio...`);
  const data = mkdtempSync(join(tmpdir(), "talend-bridge-uninstall-"));
  let removed = false;
  try {
    removed = (options.remove ?? uninstallFeature)(studio, data);
  } finally {
    rmSync(data, { recursive: true, force: true });
  }

  const after = (options.installedVersion ?? installedFeatureVersion)(studio);
  if (!removed || after) {
    fail("La desinstalacion del plugin no termino.");
    info("Revisa la salida de p2 y vuelve a intentarlo con Studio cerrado.");
    process.exitCode = 1;
    return;
  }

  // p2 quita lo que registro; un jar copiado a mano seguiria cargando el bridge.
  cleanLeftoverJars(studio);
  ok("Plugin del bridge desinstalado de Talend Studio.");
  info("Al abrir Studio ya no se cargara el bridge. Los datos locales siguen en ~/.talend-bridge.");
}
