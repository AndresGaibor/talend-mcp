/**
 * Transporte HTTP del bridge.
 *
 * Concentra la URL base, el token y el timeout; las areas del cliente solo
 * declaran rutas y cuerpos. La respuesta siempre vuelve en `BridgeResult`,
 * tambien cuando el bridge no responde.
 */

import type { BridgeConfig } from "./bridge-config";
import type {
  BridgeCapabilities,
  BridgeEnvironment,
  BridgePingPayload,
  BridgeRequestInit,
  BridgeResult,
} from "./bridge-types";

export class BridgeTransportClient {
  private readonly baseUrl: string;

  private readonly token?: string;

  private readonly timeoutMs: number;

  constructor(private readonly config: BridgeConfig, token?: string) {
    this.baseUrl = `http://${config.host}:${config.port}`;
    this.token = token;
    this.timeoutMs = config.timeoutMs;
  }

  getConfig(): BridgeConfig {
    return this.config;
  }

  async ping(): Promise<BridgeResult<BridgePingPayload>> {
    return await this.request<BridgePingPayload>("/ping", { allowUnauthenticated: true });
  }

  async capabilities(): Promise<BridgeResult<BridgeCapabilities>> {
    return await this.request<BridgeCapabilities>("/capabilities");
  }

  async auditEnvironment(): Promise<BridgeResult<BridgeEnvironment>> {
    return await this.request<BridgeEnvironment>("/audit/environment");
  }

  protected async request<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (this.token && init.allowUnauthenticated !== true) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: init.method ?? "GET",
        headers,
        signal: controller.signal,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

      const rawText = await response.text();
      const parsed = rawText.length > 0 ? this.safeParseJson<T>(rawText) : undefined;

      if (!response.ok) {
        return {
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint,
          status: response.status,
          rawText,
          error: {
            code: `HTTP_${response.status}`,
            message: this.extractMessage(parsed, rawText, response.statusText),
          },
        };
      }

      return {
        ok: true,
        source: "studio-bridge",
        confidence: "high",
        endpoint,
        status: response.status,
        data: (parsed ?? (rawText.length > 0 ? ({ rawText } as T) : undefined)) as T,
        rawText,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        source: "unavailable",
        confidence: "low",
        endpoint,
        error: { code: "BRIDGE_UNAVAILABLE", message: mensaje },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private safeParseJson<T>(value: string): T | undefined {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private extractMessage(parsed: unknown, rawText: string, fallback: string): string {
    if (parsed && typeof parsed === "object") {
      const maybeError = parsed as { error?: { message?: unknown } };
      if (typeof maybeError.error?.message === "string") {
        return maybeError.error.message;
      }
    }

    return rawText || fallback;
  }
}
