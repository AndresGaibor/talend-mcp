/**
 * Cliente HTTP del bridge de Talend Studio.
 *
 * La clase se arma por herencia: transporte, workbench, job, contextos, nodos
 * y cobertura. Este archivo conserva la API publica (tipos, fabrica y
 * `TalendStudioBridgeClient`) que ya consumian las tools.
 */

import { readTalendStudioBridgeConfig, readTalendStudioBridgeToken } from "./bridge-config";
import type { BridgeConfig } from "./bridge-config";
import { BridgeCoverageClient } from "./bridge-coverage.client";

export { readTalendStudioBridgeConfig, readTalendStudioBridgeToken } from "./bridge-config";
export type { BridgeConfig } from "./bridge-config";
export type {
  BridgeActiveJobModel,
  BridgeCapabilities,
  BridgeCommand,
  BridgeConfidence,
  BridgeEnvironment,
  BridgeError,
  BridgeLaunchConfig,
  BridgePingPayload,
  BridgeResult,
  BridgeSource,
  BridgeWorkbenchState,
} from "./bridge-types";

export async function getBridgeUrl(): Promise<string> {
  const config = await readTalendStudioBridgeConfig();
  return `http://${config.host}:${config.port}`;
}

export async function getBridgeToken(): Promise<string | undefined> {
  return await readTalendStudioBridgeToken();
}

const DEFAULT_CLIENT_CACHE_MS = 5_000;
let cachedDefaultClient: { client: TalendStudioBridgeClient; expiresAt: number } | undefined;
let defaultClientInFlight: Promise<TalendStudioBridgeClient> | undefined;

export async function createBridgeClient(options?: { config?: Partial<BridgeConfig>; token?: string }): Promise<TalendStudioBridgeClient> {
  const useDefaultCache = !options || (options.config === undefined && options.token === undefined);
  if (useDefaultCache) {
    if (cachedDefaultClient && cachedDefaultClient.expiresAt > Date.now()) return cachedDefaultClient.client;
    if (defaultClientInFlight) return defaultClientInFlight;
  }

  const create = async (): Promise<TalendStudioBridgeClient> => {
    const [fileConfig, fileToken] = await Promise.all([
      readTalendStudioBridgeConfig(),
      options?.token === undefined ? readTalendStudioBridgeToken() : Promise.resolve(options.token),
    ]);
    const config = { ...fileConfig, ...(options?.config ?? {}) };
    return new TalendStudioBridgeClient(config, options?.token ?? fileToken);
  };

  if (!useDefaultCache) return create();

  const pending = create();
  defaultClientInFlight = pending;
  try {
    const client = await pending;
    cachedDefaultClient = { client, expiresAt: Date.now() + DEFAULT_CLIENT_CACHE_MS };
    return client;
  } finally {
    if (defaultClientInFlight === pending) defaultClientInFlight = undefined;
  }
}

/** Invalida el cliente compartido; util para cambios de configuracion en proceso y tests. */
export function clearBridgeClientCache(): void {
  cachedDefaultClient = undefined;
  defaultClientInFlight = undefined;
}

export class TalendStudioBridgeClient extends BridgeCoverageClient {
  static async create(options?: { config?: Partial<BridgeConfig>; token?: string }): Promise<TalendStudioBridgeClient> {
    return createBridgeClient(options);
  }
}
