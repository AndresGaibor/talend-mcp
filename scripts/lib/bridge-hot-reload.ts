import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, utimesSync } from "node:fs";
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

const DEFAULT_BRIDGE_PORT = 3930;
const PLUGIN_ID = "com.andres.talend.bridge";

/** Campos del ping que el instalador y el estado usan. El resto del payload se ignora. */
export type BridgePing = {
  plugin: string;
  version: string;
  mode?: string;
  pid?: number;
  javaVersion?: string;
  uptimeMs?: number;
};

/**
 * Puerto del bridge: TALEND_BRIDGE_PORT, luego el de ~/.talend-bridge/config.json y
 * por ultimo el 3930. Debe coincidir con lo que lee el plugin en Java.
 */
export function bridgePort(): number {
  const fromEnv = Number(process.env.TALEND_BRIDGE_PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  try {
    const config = JSON.parse(readFileSync(join(bridgeHome(), "config.json"), "utf8")) as { port?: unknown };
    if (typeof config.port === "number" && Number.isInteger(config.port)) return config.port;
  } catch {
    // Sin archivo (o corrupto) el plugin usa el puerto por defecto.
  }
  return DEFAULT_BRIDGE_PORT;
}

/** Carpeta ~/.talend-bridge, donde viven la configuracion, el token y la carga en caliente. */
export function bridgeHome(): string {
  return join(homedir(), ".talend-bridge");
}

/** Respuesta de /ping del bridge, o null si no responde o no es el plugin. */
export async function runningBridgePing(): Promise<BridgePing | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${bridgePort()}/ping`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<BridgePing>;
    if (payload.plugin !== PLUGIN_ID) return null;
    return { ...payload, plugin: PLUGIN_ID, version: payload.version ?? "desconocida" } as BridgePing;
  } catch {
    return null;
  }
}

/** Version del bundle que esta sirviendo el bridge ahora, o null si no responde. */
export async function runningBridgeVersion(): Promise<string | null> {
  return (await runningBridgePing())?.version ?? null;
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
 * Debe coincidir con `HotReloadService.hotJarPath()` del lado Java: si la variable
 * esta vacia, el plugin usa la carpeta por defecto, y aqui tambien.
 */
export function hotJarPath(): string {
  const dir = process.env.TALEND_BRIDGE_HOT_DIR?.trim() || join(bridgeHome(), "hot");
  return join(dir, "bridge.jar");
}

/** Un jar es un zip: empieza por "PK" y tiene al menos la cola del directorio central. */
export function isJarFile(path: string): boolean {
  try {
    const content = readFileSync(path);
    return content.length >= 22 && content[0] === 0x50 && content[1] === 0x4b;
  } catch {
    return false;
  }
}

/**
 * Copia el jar compilado a la carpeta de carga en caliente.
 *
 * Se escribe primero junto al destino y luego se renombra: el watcher del plugin
 * nunca ve un jar a medias (si lo viera, la recarga fallaria o cargaria basura).
 */
export function publishHotJar(jarPath: string): string | undefined {
  if (!isJarFile(jarPath)) {
    warn(`No se publica ${jarPath}: no es un jar valido.`);
    return undefined;
  }

  const target = hotJarPath();
  const staging = `${target}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(jarPath, staging);
    // Fecha nueva: la firma del watcher es tamanio y fecha de modificacion.
    const now = new Date();
    utimesSync(staging, now, now);
    renameWithRetry(staging, target);
    return target;
  } catch (error) {
    removeQuietly(staging);
    warn(`No se pudo publicar el jar para carga en caliente: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * En Windows el renombrado sobre un archivo puede fallar un instante si otro proceso
 * (un antivirus, el propio watcher) lo tiene abierto. Se reintenta con una pausa corta.
 */
function renameWithRetry(from: string, to: string, attempts = 5): void {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryable = code === "EPERM" || code === "EBUSY";
      if (!retryable || attempt >= attempts) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * attempt);
    }
  }
}

function removeQuietly(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // Un temporal que no se puede borrar no afecta a la instalacion.
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
