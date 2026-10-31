import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { PayloadTooLargeError, readBody } from "../../src/presentation/server/new-server/http-routes";
import { runNewHttpServer } from "../../src/presentation/server/new-server";

function peticion(...chunks: string[]): IncomingMessage {
  return Readable.from(chunks.map((chunk) => Buffer.from(chunk, "utf8"))) as unknown as IncomingMessage;
}

describe("readBody", () => {
  test("devuelve el cuerpo cuando no pasa del tope", async () => {
    await expect(readBody(peticion("{\"a\":1}"), 1024)).resolves.toBe("{\"a\":1}");
  });

  test("corta en cuanto el cuerpo pasa del tope", async () => {
    const error = await readBody(peticion("x".repeat(64), "y".repeat(64)), 100).catch((err) => err);
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect((error as PayloadTooLargeError).maxBytes).toBe(100);
  });

  test("cuenta bytes UTF-8, no caracteres", async () => {
    // 40 caracteres, 80 bytes: con tope 50 debe fallar aunque parezca corto.
    await expect(readBody(peticion("ñ".repeat(40)), 50)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});

describe("servidor HTTP", () => {
  test("responde 413 a un cuerpo que supera el tope", async () => {
    const server = await runNewHttpServer({ port: 0, maxBodyBytes: 64 });
    try {
      const response = await fetch(`${server.localUrl}/mcp`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { relleno: "x".repeat(200) } }),
      });
      expect(response.status).toBe(413);
      const payload = await response.json() as { error?: string; maxBytes?: number };
      expect(payload.error).toBe("payload_too_large");
      expect(payload.maxBytes).toBe(64);
    } finally {
      await server.close();
    }
  });

  test("falla claro si el puerto pedido esta ocupado, en vez de usar uno al azar", async () => {
    const primero = await runNewHttpServer({ port: 0 });
    try {
      const puerto = Number(new URL(primero.localUrl).port);
      await expect(runNewHttpServer({ port: puerto })).rejects.toThrow(/ya esta ocupado/);
    } finally {
      await primero.close();
    }
  });

  test("expone memoria y peticiones en vuelo en /metrics", async () => {
    const server = await runNewHttpServer({ port: 0, maxBodyBytes: 1024 });
    try {
      const response = await fetch(`${server.localUrl}/metrics`);
      expect(response.status).toBe(200);
      const payload = await response.json() as {
        memory?: { rssBytes?: number; heapUsedBytes?: number };
        activeRequests?: number;
        maxBodyBytes?: number;
        toolCount?: number;
      };
      expect(payload.memory?.rssBytes).toBeGreaterThan(0);
      expect(payload.memory?.heapUsedBytes).toBeGreaterThan(0);
      expect(payload.maxBodyBytes).toBe(1024);
      expect(payload.activeRequests).toBeGreaterThanOrEqual(0);
      expect(payload.toolCount).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });
});
