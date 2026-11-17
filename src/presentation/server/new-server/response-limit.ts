/**
 * Tope de una respuesta de tool en el servidor HTTP.
 *
 * El SDK escribe la respuesta en streaming (`writeHead` + `write` + `end`), asi
 * que mirar solo `end` no alcanza: una respuesta grande se colaba entera. Aqui
 * se retiene la salida hasta saber su tamano. Si cabe, se envia tal cual; si no,
 * se descarta y se responde un error JSON-RPC con el tope, la tool y la salida.
 *
 * Retener la salida cuesta memoria, pero acotada por el propio tope: nunca se
 * guardan mas bytes de los que se van a permitir.
 */

import type { ServerResponse } from "node:http";

export type TopeDeRespuesta = {
  /** Bytes maximos que se aceptan en la respuesta serializada. */
  maxBytes: number;
  /** Tool que produjo la respuesta, para el mensaje de error. */
  tool: string;
  /** Id JSON-RPC de la peticion, para devolver un error correlacionable. */
  id: unknown;
  /** Frase concreta para reducir la respuesta; por defecto se sugiere paginar. */
  sugerencia?: string;
};

type Trozo = {
  chunk: string | Uint8Array;
  encoding?: BufferEncoding;
  cb?: () => void;
};

const SUGERENCIA_POR_DEFECTO =
  "Pide menos datos (limit, offset, filtro o paginacion) o sube TALEND_MCP_MAX_RESPONSE_BYTES.";

function bytesDe(chunk: unknown, encoding?: unknown): number {
  if (typeof chunk === "string") {
    return Buffer.byteLength(chunk, (encoding as BufferEncoding | undefined) ?? "utf8");
  }
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  if (chunk === undefined || chunk === null) return 0;
  return Buffer.byteLength(String(chunk), "utf8");
}

/**
 * Instala el tope en `res`. Debe llamarse antes de entregar la peticion al SDK.
 */
export function aplicarTopeDeRespuesta(res: ServerResponse, tope: TopeDeRespuesta): void {
  const originalWriteHead = res.writeHead.bind(res) as (...args: any[]) => ServerResponse;
  const originalWrite = res.write.bind(res) as (...args: any[]) => boolean;
  const originalEnd = res.end.bind(res) as (...args: any[]) => ServerResponse;

  const sugerencia = tope.sugerencia ?? SUGERENCIA_POR_DEFECTO;
  let cabecera: { status: number; headers?: unknown } | undefined;
  let trozos: Trozo[] = [];
  let total = 0;
  let cerrado = false;

  const responderError = (): void => {
    if (cerrado) return;
    cerrado = true;
    trozos = [];
    const cuerpo = JSON.stringify({
      jsonrpc: "2.0",
      id: tope.id ?? null,
      error: {
        code: -32603,
        message: `La respuesta de ${tope.tool} supera el tope de ${tope.maxBytes} bytes y no se envia entera. ${sugerencia}`,
        data: {
          code: "RESPONSE_TOO_LARGE",
          tool: tope.tool,
          maxBytes: tope.maxBytes,
          suggestion: sugerencia,
        },
      },
    });
    try {
      originalWriteHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(cuerpo, "utf8"),
      } as never);
      originalEnd(cuerpo as never);
    } catch {
      try {
        res.destroy();
      } catch {
        // El socket ya estaba cerrado.
      }
    }
  };

  // `writeHead` y `flushHeaders` se difieren: si la respuesta no cabe, hace
  // falta poder contestar un error JSON-RPC limpio en vez de un stream a medias.
  res.writeHead = ((status: number, headers?: unknown) => {
    if (!cerrado) cabecera = { status, headers };
    return res;
  }) as typeof res.writeHead;

  res.flushHeaders = (() => {
    // Se ignora a proposito; ver comentario de arriba.
  }) as typeof res.flushHeaders;

  res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
    if (typeof chunk === "function") {
      (chunk as () => void)();
      return true;
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = undefined;
    }
    if (cerrado) return true;
    const bytes = bytesDe(chunk, encoding);
    if (total + bytes > tope.maxBytes) {
      responderError();
      return true;
    }
    total += bytes;
    trozos.push({
      chunk: chunk as string | Uint8Array,
      encoding: typeof encoding === "string" ? (encoding as BufferEncoding) : undefined,
      cb: typeof cb === "function" ? (cb as () => void) : undefined,
    });
    return true;
  }) as typeof res.write;

  res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
    if (typeof chunk === "function") {
      (chunk as () => void)();
      return res;
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = undefined;
    }
    if (cerrado) return res;
    const bytes = chunk === undefined ? 0 : bytesDe(chunk, encoding);
    if (total + bytes > tope.maxBytes) {
      responderError();
      return res;
    }

    cerrado = true;
    try {
      originalWriteHead((cabecera?.status ?? 200) as never, cabecera?.headers as never);
      for (const trozo of trozos) {
        originalWrite(trozo.chunk as never, trozo.encoding as never);
        trozo.cb?.();
      }
      if (chunk !== undefined) {
        originalWrite(chunk as never, (typeof encoding === "string" ? encoding : undefined) as never);
      }
      originalEnd();
      if (typeof cb === "function") (cb as () => void)();
    } catch {
      try {
        res.destroy();
      } catch {
        // El socket ya estaba cerrado.
      }
    }
    return res;
  }) as typeof res.end;
}
