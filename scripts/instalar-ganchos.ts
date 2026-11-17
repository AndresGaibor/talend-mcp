/**
 * Activa el gancho `pre-commit` versionado en `.githooks/`.
 *
 *   bun run ganchos:instalar
 *
 * `core.hooksPath` es configuracion local de Git: se hace una vez por copia del repositorio y no se
 * versiona. El gancho si se versiona; este comando solo lo activa y, fuera de Windows, le da
 * permiso de ejecucion.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

import { REPO } from "./validacion";

export const GANCHO = join(".githooks", "pre-commit");

export function instalar(repo = REPO): number {
  const gancho = join(repo, GANCHO);
  if (!existsSync(gancho)) {
    console.error(`Falta el gancho ${gancho}.`);
    return 1;
  }
  const proceso = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: repo,
    encoding: "utf8",
  });
  if (proceso.status !== 0) {
    console.error(`No se pudo configurar core.hooksPath: ${String(proceso.stderr ?? "").trim()}`);
    return 1;
  }
  if (process.platform !== "win32") {
    chmodSync(gancho, 0o755);
  }
  console.log("Gancho instalado: core.hooksPath=.githooks");
  console.log("Estado del candado: bun run scripts/validacion.ts estado");
  return 0;
}

if (import.meta.main) {
  process.exit(instalar());
}
