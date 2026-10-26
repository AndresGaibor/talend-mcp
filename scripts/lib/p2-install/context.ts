import { spawnSync } from "node:child_process";

import { createStyler, createUi, shouldUseColor } from "../../../src/shared/cli/ui";
import type { StudioInstall } from "../studio-detect";

/**
 * Contexto compartido del instalador p2: salida y ejecucion del director.
 *
 * La UI y el estilizador se crean una sola vez al importar el modulo, igual
 * que el resto de los scripts de operacion.
 */

export const ui = createUi();
export const { ok, info, warn } = ui;
export const c = createStyler(shouldUseColor(process.env, Boolean(process.stderr.isTTY)));

export const FEATURE_IU = "com.andres.talend.bridge.feature.feature.group";

export function p2Director(studio: StudioInstall, args: string[]): number {
  const result = spawnSync(studio.exe, args, { stdio: "inherit", shell: false });
  return result.status ?? 1;
}
