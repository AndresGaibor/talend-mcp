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
  BridgeLogTail,
  BridgePingPayload,
  BridgeRequestInit,
  BridgeResult,
} from "./bridge-types";

/**
 * Frase para quien llama cuando el bridge no contesta.
 *
 * El error crudo de `fetch` (`ECONNREFUSED: Unable to connect...`) no dice que
 * falla el bridge de Studio ni que hacer. La frase lo dice y deja el detalle
 * original al final, por si hace falta para depurar.
 */
export function mensajeDeConexion(error: unknown, baseUrl: string, timeoutMs: number): string {
  const detalle = error instanceof Error ? error.message : String(error);
  const nombre = error instanceof Error ? error.name : "";
  if (nombre === "AbortError" || /abort/i.test(detalle)) {
    return `El bridge de Talend Studio en ${baseUrl} no contesto en ${timeoutMs} ms: Studio puede estar ocupado (compilando o con un dialogo abierto). Se puede reintentar. (detalle: ${detalle})`;
  }
  if (/ECONNREFUSED|Unable to connect|fetch failed|Failed to fetch/i.test(detalle)) {
    return `No hay bridge de Talend Studio en ${baseUrl}: Studio no esta abierto con el plugin, o el puerto no es el del bridge. Revisa con "bun run bridge:status". (detalle: ${detalle})`;
  }
  if (/ECONNRESET|socket connection was closed/i.test(detalle)) {
    return `El bridge en ${baseUrl} cerro la conexion a mitad de la respuesta: Studio puede estar reiniciando. Se puede reintentar. (detalle: ${detalle})`;
  }
  return detalle;
}

/** Tope si la configuracion no lo trae (configuraciones viejas de ~/.talend-bridge). */
const MAX_RESPUESTA_POR_DEFECTO = 16 * 1024 * 1024;

/**
 * El bridge devolvio mas bytes de los permitidos.
 *
 * `response.text()` materializa la respuesta entera: un log de Studio o un
 * catalogo de cientos de MB entra completo en el heap del MCP antes de que
 * nadie lo mire. Se lee por trozos y se corta al pasar del tope.
 */
export class RespuestaDelBridgeDemasiadoGrande extends Error {
  constructor(readonly maxBytes: number, readonly recibidos: number) {
    super(`El bridge devolvio ${recibidos} bytes y el tope es ${maxBytes}. No se lee la respuesta entera para no agotar la memoria del MCP.`);
    this.name = "RespuestaDelBridgeDemasiadoGrande";
  }
}

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

  /** Ultimas `lines` lineas del Error Log de Studio (el servidor acota el maximo). */
  async logTail(lines = 200): Promise<BridgeResult<BridgeLogTail>> {
    return await this.request<BridgeLogTail>(`/logs/tail?lines=${Math.trunc(lines)}`);
  }

  protected async request<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    const controller = new AbortController();
    const timeoutMs = init.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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

      const rawText = await this.leerCuerpo(response, this.config.maxResponseBytes ?? MAX_RESPUESTA_POR_DEFECTO);
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
      if (error instanceof RespuestaDelBridgeDemasiadoGrande) {
        return {
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint,
          error: { code: "BRIDGE_RESPONSE_TOO_LARGE", message: error.message },
        };
      }
      return {
        ok: false,
        source: "unavailable",
        confidence: "low",
        endpoint,
        error: {
          code: "BRIDGE_UNAVAILABLE",
          message: mensajeDeConexion(error, this.baseUrl, timeoutMs),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Lee el cuerpo por trozos, cortando en cuanto pasa del tope. */
  private async leerCuerpo(response: Response, maxBytes: number): Promise<string> {
    const declarado = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declarado) && declarado > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new RespuestaDelBridgeDemasiadoGrande(maxBytes, declarado);
    }
    if (!response.body) {
      return await response.text();
    }

    const reader = response.body.getReader();
    const trozos: Buffer[] = [];
    let total = 0;
    let excedido = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          excedido = true;
          throw new RespuestaDelBridgeDemasiadoGrande(maxBytes, total);
        }
        trozos.push(Buffer.from(value));
      }
    } finally {
      if (excedido) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return Buffer.concat(trozos).toString("utf8");
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
