import { join } from "node:path";
import { detectRuntimeOS, isWsl } from "../../../platform/runtime";
import { toMcpPath } from "../../../platform/path-bridge";

export type BridgeConfig = {
  host: string;
  port: number;
  readOnly: boolean;
  unsafeActions: boolean;
  allowAllCommands: boolean;
  allowCommands: string[];
  timeoutMs: number;
  /** Tope de bytes que se aceptan del bridge en una respuesta (64 MiB por defecto). */
  maxResponseBytes?: number;
};

/**
 * Tope de respuesta del bridge.
 *
 * 64 MiB cubre el modelo de un job grande y las respuestas del catalogo; por
 * encima de eso ya no es un resultado utilizable, es un volcado que agota la
 * memoria del MCP. Se puede subir con `TALEND_BRIDGE_MAX_RESPONSE_BYTES`.
 */
export const MAX_RESPONSE_BYTES_POR_DEFECTO = 64 * 1024 * 1024;

/** Por debajo de este tope no cabe ni el modelo de un job pequeno. */
export const MAX_RESPONSE_BYTES_MINIMO = 64 * 1024;

const DEFAULT_CONFIG: BridgeConfig = {
  host: "127.0.0.1",
  port: 3930,
  readOnly: true,
  unsafeActions: false,
  allowAllCommands: false,
  allowCommands: ["org.eclipse.ui.file.save", "org.eclipse.ui.file.saveAll"],
  timeoutMs: 2_500,
  maxResponseBytes: MAX_RESPONSE_BYTES_POR_DEFECTO,
};

/** Tope configurado por entorno; ignora valores invalidos en vez de romper el arranque. */
export function maxResponseBytesDelEntorno(): number | undefined {
  const raw = process.env.TALEND_BRIDGE_MAX_RESPONSE_BYTES;
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= MAX_RESPONSE_BYTES_MINIMO ? Math.trunc(value) : undefined;
}

function getHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? ".";
}

function getWindowsHomeDir(): string | undefined {
  if (!isWsl()) return undefined;
  try {
    const result = Bun.spawnSync(["cmd.exe", "/C", "echo", "%USERPROFILE%"], { timeout: 10_000 });
    const rawPath = result.stdout?.toString().trim();
    return rawPath ? wslPathToMcp(rawPath) : undefined;
  } catch {
    return undefined;
  }
}

function expandHomePath(path: string): string {
  if (!path.startsWith("~")) return path;
  return join(getHomeDir(), path.slice(1).replace(/^[\\/]/, ""));
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await Bun.file(filePath).text()) as T;
  } catch {
    return undefined;
  }
}

async function readTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await Bun.file(filePath).text();
  } catch {
    return undefined;
  }
}

function wslPathToMcp(rawWindowsPath: string): string {
  return toMcpPath(rawWindowsPath, {
    runtimeOs: "wsl",
    talendHostOs: "windows",
    pathMode: "wsl-windows",
  });
}

function detectTalendHostOs(): "windows" | "macos" | "linux" {
  const env = process.env.TALEND_HOST_OS;
  if (env === "windows" || env === "macos" || env === "linux") return env;
  const runtime = detectRuntimeOS();
  return runtime === "wsl" ? "windows" : runtime;
}

function applyEnvOverrides(config: BridgeConfig): BridgeConfig {
  return {
    ...config,
    host: process.env.TALEND_BRIDGE_HOST ?? config.host,
    port: process.env.TALEND_BRIDGE_PORT ? Number(process.env.TALEND_BRIDGE_PORT) : config.port,
    maxResponseBytes: maxResponseBytesDelEntorno() ?? config.maxResponseBytes ?? MAX_RESPONSE_BYTES_POR_DEFECTO,
  };
}

export async function readTalendStudioBridgeConfig(): Promise<BridgeConfig> {
  const envConfig = process.env.TALEND_BRIDGE_CONFIG;
  if (envConfig) {
    const parsed = await readJsonFile<Partial<BridgeConfig>>(expandHomePath(envConfig));
    if (parsed) {
      return applyEnvOverrides({
        ...DEFAULT_CONFIG,
        ...parsed,
        allowCommands: parsed.allowCommands?.length ? parsed.allowCommands : DEFAULT_CONFIG.allowCommands,
        allowAllCommands: parsed.allowAllCommands ?? DEFAULT_CONFIG.allowAllCommands,
      });
    }
  }

  const parsed = await readJsonFile<Partial<BridgeConfig>>(expandHomePath("~/.talend-bridge/config.json"));
  if (!parsed && detectRuntimeOS() === "wsl" && detectTalendHostOs() === "windows") {
    const windowsHome = getWindowsHomeDir();
    if (windowsHome) {
      const windowsPath = join(wslPathToMcp(windowsHome), ".talend-bridge", "config.json");
      const windowsConfig = await readJsonFile<Partial<BridgeConfig>>(windowsPath);
      if (windowsConfig) {
        return applyEnvOverrides({
          ...DEFAULT_CONFIG,
          ...windowsConfig,
          allowCommands: windowsConfig.allowCommands?.length ? windowsConfig.allowCommands : DEFAULT_CONFIG.allowCommands,
          allowAllCommands: windowsConfig.allowAllCommands ?? DEFAULT_CONFIG.allowAllCommands,
        });
      }
    }
  }

  return applyEnvOverrides({
    ...DEFAULT_CONFIG,
    ...parsed,
    allowCommands: parsed?.allowCommands?.length ? parsed.allowCommands : DEFAULT_CONFIG.allowCommands,
    allowAllCommands: parsed?.allowAllCommands ?? DEFAULT_CONFIG.allowAllCommands,
  });
}

export async function readTalendStudioBridgeToken(): Promise<string | undefined> {
  const envToken = process.env.TALEND_BRIDGE_TOKEN;
  if (envToken) {
    const token = (await readTextFile(expandHomePath(envToken)))?.trim();
    if (token) return token;
  }

  let token = await readTextFile(expandHomePath("~/.talend-bridge/token"));
  if (!token && detectRuntimeOS() === "wsl" && detectTalendHostOs() === "windows") {
    const windowsHome = getWindowsHomeDir();
    if (windowsHome) {
      token = await readTextFile(join(wslPathToMcp(windowsHome), ".talend-bridge", "token"));
    }
  }
  const normalized = token?.trim();
  return normalized || undefined;
}
