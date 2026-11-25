/**
 * Transporte HTTP del bridge.
 *
 * Concentra la URL base, el token y el timeout; las areas del cliente solo
 * declaran rutas y cuerpos. La respuesta siempre vuelve en `BridgeResult`,
 * tambien cuando el bridge no responde.
 */

import {
  MAX_RESPONSE_BYTES_POR_DEFECTO,
  type BridgeConfig,
} from "./bridge-config";
import type {
  BridgeCapabilities,
  BridgeDialogoAtendido,
  BridgeEnvironment,
  BridgeLogTail,
  BridgePingPayload,
  BridgeRecovery,
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

/** Fallo que se puede intentar resolver atendiendo un dialogo y repitiendo la peticion. */
export type BridgeFalloRecuperable = "timeout" | "conexion-cortada";

export type BridgeRecoveryMotivo = {
  endpoint: string;
  codigo: BridgeFalloRecuperable;
  detalle: string;
};

export type BridgeRecoveryOutcome = {
  /** Si conviene repetir la peticion despues de atender los dialogos. */
  reintentar: boolean;
  dialogos?: BridgeDialogoAtendido[];
  detalle?: string;
};

/**
 * Hook que atiende dialogos de Studio cuando el bridge no contesta.
 *
 * Vive fuera de este modulo para no invertir capas: el transporte no sabe de
 * UI Automation ni de la politica de modales. `src/talend/studio` lo instala
 * al arrancar.
 */
export type BridgeRecoveryHook = (motivo: BridgeRecoveryMotivo) => Promise<BridgeRecoveryOutcome>;

let recuperacionRegistrada: BridgeRecoveryHook | undefined;

/** Instala (o quita, con `undefined`) el hook de recuperacion. */
export function setBridgeRecoveryHook(hook: BridgeRecoveryHook | undefined): void {
  recuperacionRegistrada = hook;
}

export function getBridgeRecoveryHook(): BridgeRecoveryHook | undefined {
  return recuperacionRegistrada;
}

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

/** Clasifica el fallo de red que merece la pena recuperar. */
export function clasificarFallo(error: unknown): BridgeFalloRecuperable | undefined {
  const detalle = error instanceof Error ? error.message : String(error);
  const nombre = error instanceof Error ? error.name : "";
  if (nombre === "AbortError" || /abort/i.test(detalle)) return "timeout";
  if (/ECONNRESET|socket connection was closed/i.test(detalle)) return "conexion-cortada";
  return undefined;
}

/** Frase para el usuario: que dialogos se atendieron y si se reintento. */
export function describirRecuperacion(recovery: BridgeRecovery): string {
  const partes: string[] = [];
  if (recovery.dialogos.length > 0) {
    const detalle = recovery.dialogos
      .map((dialogo) => (dialogo.pressed ? `"${dialogo.title}" (${dialogo.pressed})` : `"${dialogo.title}" (${dialogo.decision})`))
      .join(", ");
    partes.push(`Se atendieron ${recovery.dialogos.length} dialogo(s) de Studio: ${detalle}.`);
  } else {
    partes.push("No habia dialogos de Studio que atender.");
  }
  if (recovery.reintentado) partes.push("Se reintento la operacion una vez.");
  if (recovery.detalle) partes.push(recovery.detalle);
  return partes.join(" ");
}

function conRecuperacion<T>(resultado: BridgeResult<T>, recovery: BridgeRecovery): BridgeResult<T> {
  const nota = describirRecuperacion(recovery);
  if (resultado.ok) {
    return { ...resultado, recovery, warning: nota };
  }
  return {
    ...resultado,
    recovery,
    error: resultado.error
      ? {
          ...resultado.error,
          message: `${resultado.error.message} ${nota}`.trim(),
          details: { ...(resultado.error.details ?? {}), recovery },
        }
      : resultado.error,
  };
}

const REINTENTOS_INTERFAZ_OCUPADA = 4;
const PAUSA_INTERFAZ_OCUPADA_MS = 5000;

/** El mensaje que Studio da cuando su hilo de interfaz esta ocupado (la operacion no se aplico). */
function interfazOcupada<T>(resultado: BridgeResult<T>): boolean {
  return !resultado.ok && /hilo de la interfaz de studio esta ocupado|interfaz.*ocupad/i.test(resultado.error?.message ?? "");
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
    let resultado = await this.solicitarUnaVez<T>(endpoint, init);
    // Studio responde «hilo de la interfaz ocupado» antes de aplicar la operacion: es seguro esperar y repetirla,
    // tambien en escrituras. Se espera de forma creciente y se rinde tras unos intentos. No se pulsan dialogos
    // aqui: una ventana que abrio una persona no se cierra sola mientras el MCP trabaja.
    for (
      let intento = 1;
      intento <= REINTENTOS_INTERFAZ_OCUPADA && interfazOcupada(resultado) && init.sinRecuperacion !== true;
      intento++
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, PAUSA_INTERFAZ_OCUPADA_MS * intento));
      resultado = await this.solicitarUnaVez<T>(endpoint, init);
    }
    return resultado;
  }

  protected async solicitarUnaVez<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    const primera = await this.ejecutar<T>(endpoint, init);
    if (primera.resultado.ok || !primera.motivo || init.sinRecuperacion === true) {
      return primera.resultado;
    }

    const hook = recuperacionRegistrada;
    if (!hook) return primera.resultado;

    let outcome: BridgeRecoveryOutcome = { reintentar: false };
    try {
      outcome = await hook({
        endpoint,
        codigo: primera.motivo,
        detalle: primera.resultado.error?.message ?? "",
      });
    } catch (error) {
      outcome = {
        reintentar: false,
        detalle: `No se pudieron atender los dialogos de Studio: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Una escritura que expiro pudo aplicarse igual: repetirla puede duplicar
    // nodos o contextos. Solo se reintenta si quien llama lo declara idempotente.
    const metodo = init.method ?? "GET";
    const seguroReintentar = metodo === "GET" || init.reintentarTrasModal === true;
    const reintentar = outcome.reintentar && seguroReintentar;
    const recovery: BridgeRecovery = {
      motivo: primera.motivo,
      dialogos: outcome.dialogos ?? [],
      reintentado: reintentar,
      detalle:
        outcome.detalle ??
        (seguroReintentar || reintentar
          ? undefined
          : "No se reintenta sola una escritura: la operacion pudo aplicarse. Revisa el estado antes de repetirla."),
    };

    if (!reintentar) return conRecuperacion(primera.resultado, recovery);

    const segunda = await this.ejecutar<T>(endpoint, { ...init, sinRecuperacion: true });
    return conRecuperacion(segunda.resultado, recovery);
  }

  private async ejecutar<T>(
    endpoint: string,
    init: BridgeRequestInit,
  ): Promise<{ resultado: BridgeResult<T>; motivo?: BridgeFalloRecuperable }> {
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

      const rawText = await this.leerCuerpo(response, this.topeDeRespuesta());
      const parsed = rawText.length > 0 ? this.safeParseJson<T>(rawText) : undefined;

      if (!response.ok) {
        return {
          resultado: {
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
          },
        };
      }

      return {
        resultado: {
          ok: true,
          source: "studio-bridge",
          confidence: "high",
          endpoint,
          status: response.status,
          data: (parsed ?? (rawText.length > 0 ? ({ rawText } as T) : undefined)) as T,
          rawText,
        },
      };
    } catch (error) {
      if (error instanceof RespuestaDelBridgeDemasiadoGrande) {
        return {
          resultado: {
            ok: false,
            source: "studio-bridge",
            confidence: "low",
            endpoint,
            error: {
              code: "BRIDGE_RESPONSE_TOO_LARGE",
              message: `${error.message} Pide menos datos (limit, offset, lines o filtro por job) o sube TALEND_BRIDGE_MAX_RESPONSE_BYTES.`,
              details: {
                endpoint,
                maxBytes: error.maxBytes,
                recibidos: error.recibidos,
                variable: "TALEND_BRIDGE_MAX_RESPONSE_BYTES",
              },
            },
          },
        };
      }
      return {
        resultado: {
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint,
          error: {
            code: "BRIDGE_UNAVAILABLE",
            message: mensajeDeConexion(error, this.baseUrl, timeoutMs),
          },
        },
        motivo: clasificarFallo(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Tope efectivo: el de la configuracion o el de por defecto si viene invalido. */
  private topeDeRespuesta(): number {
    const configurado = this.config.maxResponseBytes;
    return typeof configurado === "number" && Number.isFinite(configurado) && configurado > 0
      ? Math.trunc(configurado)
      : MAX_RESPONSE_BYTES_POR_DEFECTO;
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
