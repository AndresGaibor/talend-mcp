import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Jar de carga en caliente que publica `bridge install`; la firma evita recargas en bucle. */
export function hotJarFiles(): string[] {
  const dir = process.env.TALEND_BRIDGE_HOT_DIR?.trim() || join(homedir(), ".talend-bridge", "hot");
  const jar = join(dir, "bridge.jar");
  return [jar, `${jar}.sig`];
}

/** Borra el jar y su firma. Devuelve `true` si habia algo que borrar. */
export function clearHotJar(): boolean {
  let removed = false;
  for (const path of hotJarFiles()) {
    if (!existsSync(path)) continue;
    try {
      rmSync(path, { force: true });
      removed = true;
    } catch {}
  }
  return removed;
}
