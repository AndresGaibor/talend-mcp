import { execSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, utimesSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir, platform } from "node:os";

import { createUi } from "../../src/shared/cli/ui";
import type { StudioInstall } from "./studio-detect";

/**
 * Estado del bridge y carga en caliente.
 *
 * El plugin instalado vigila `~/.talend-bridge/hot/bridge.jar` y se recarga
 * solo cuando el archivo cambia, sin reiniciar Talend Studio. El ping permite
 * saber que version esta sirviendo y evitar publicar dos veces el mismo jar.
 */

const IS_WIN = platform() === "win32";
const ui = createUi();
const { ok, warn } = ui;

const BRIDGE_PING_URL = "http://127.0.0.1:3930/ping";

/** Version del bundle que esta sirviendo el bridge ahora, o null si no responde. */
export async function runningBridgeVersion(): Promise<string | null> {
  try {
    const response = await fetch(BRIDGE_PING_URL, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { plugin?: string; version?: string };
    return payload.plugin === "com.andres.talend.bridge" ? (payload.version ?? "desconocida") : null;
  } catch {
    return null;
  }
}

export async function isStudioRunning(studio: StudioInstall): Promise<boolean> {
  // Si el bridge contesta, Studio esta abierto: evita lanzar `tasklist` (~0,5 s).
  if ((await runningBridgeVersion()) !== null) return true;
  if (IS_WIN) {
    // tasklist trunca el nombre de la imagen a 25 caracteres, asi que no se
    // puede filtrar por el nombre completo: se busca el prefijo.
    const result = spawnSync("tasklist", ["/NH", "/FO", "CSV"], { encoding: "utf8" });
    const marker = basename(studio.exe).slice(0, 15).toLowerCase();
    return (result.stdout ?? "").toLowerCase().includes(marker);
  }
  try {
    const out = execSync("pgrep -fl Talend-Studio 2>/dev/null || echo ''", { encoding: "utf8" });
    return out.includes("Talend-Studio");
  } catch {
    return false;
  }
}

/**
 * Carpeta donde el plugin vigila el jar para recargarse en caliente.
 * Debe coincidir con `HotReloadService.hotJarPath()` del lado Java.
 */
function hotJarPath(): string {
  const dir = process.env.TALEND_BRIDGE_HOT_DIR
    ?? join(homedir(), ".talend-bridge", "hot");
  return join(dir, "bridge.jar");
}

/** Copia el jar compilado a la carpeta de carga en caliente. */
export function publishHotJar(jarPath: string): string | undefined {
  try {
    const target = hotJarPath();
    mkdirSync(dirname(target), { recursive: true });
    cpSync(jarPath, target, { force: true });
    // `cpSync` conserva el mtime del jar de origen. Si el bundle se compiló
    // antes de iniciar Studio, el watcher puede haber memorizado esa misma
    // firma y no detectar la copia aunque haya que cargar una versión nueva.
    const now = new Date();
    utimesSync(target, now, now);
    return target;
  } catch (error) {
    warn(`No se pudo publicar el jar para carga en caliente: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Espera a que el bridge responda con la version recien publicada.
 *
 * El watcher del plugin lee el jar nuevo, recarga el bundle y reinicia el
 * servidor HTTP: la respuesta llega con el mismo numero de version (la version
 * la fija el build), asi que se valida que el bridge siga respondiendo.
 */
export async function waitForHotReload(expectedVersion?: string, timeoutMs = 30_000): Promise<boolean> {
  const started = Date.now();
  const deadline = started + timeoutMs;
  let sawDown = false;
  let sawUp = false;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const version = await runningBridgeVersion();
    if (version === null) {
      sawDown = true;
      // Si el bridge ni siquiera estaba arriba (Studio arrancando), no hay
      // nada que recargar: el watcher tomara el jar cuando el plugin cargue.
      if (!sawUp && Date.now() - started > 8_000) {
        warn("El bridge no responde (¿Studio todavia arrancando?). Cargara el bundle nuevo al iniciar.");
        return false;
      }
      continue;
    }
    sawUp = true;

    // Con una version esperada (build rapido: lleva un calificador unico) se
    // sabe exactamente cuando el bundle nuevo ya atiende. Sin ella, solo se
    // puede confiar en haber visto el bridge caer y volver.
    if (expectedVersion ? version === expectedVersion : sawDown) {
      ok("El bridge se reinicio con el bundle nuevo.");
      return true;
    }
  }

  return false;
}
