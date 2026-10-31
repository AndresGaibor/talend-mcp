import { afterAll, describe, expect, test } from "bun:test";
import { BridgeTransportClient, mensajeDeConexion } from "../../src/modules/studio-bridge/adapters/bridge-transport";
import type { BridgeConfig } from "../../src/modules/studio-bridge/adapters/bridge-config";

const baseUrl = "http://127.0.0.1:3930";

describe("mensajeDeConexion", () => {
  test("si nada escucha en el puerto, dice que no hay bridge y como comprobarlo", () => {
    const mensaje = mensajeDeConexion(
      new Error("ECONNREFUSED: Unable to connect. Is the computer able to access the url?"),
      baseUrl,
      1_000,
    );

    expect(mensaje).toContain(`No hay bridge de Talend Studio en ${baseUrl}`);
    expect(mensaje).toContain("bun run bridge:status");
    expect(mensaje).toContain("(detalle: ECONNREFUSED");
  });

  test("una cancelacion por tiempo agotado dice cuanto se espero y que se puede reintentar", () => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";

    const mensaje = mensajeDeConexion(error, baseUrl, 180_000);

    expect(mensaje).toContain(`no contesto en 180000 ms`);
    expect(mensaje).toContain("Se puede reintentar");
  });

  test("una conexion cortada a mitad de respuesta no se confunde con un bridge caido", () => {
    const mensaje = mensajeDeConexion(new Error("The socket connection was closed unexpectedly"), baseUrl, 1_000);

    expect(mensaje).toContain("cerro la conexion a mitad de la respuesta");
    expect(mensaje).not.toContain("No hay bridge");
  });

  test("un error que no es de red pasa tal cual", () => {
    expect(mensajeDeConexion(new Error("otra cosa"), baseUrl, 1_000)).toBe("otra cosa");
  });

  test("algo que no es un Error se convierte a texto", () => {
    expect(mensajeDeConexion("boom", baseUrl, 1_000)).toBe("boom");
  });
});

/** Respuesta grande de un bridge de mentira, para comprobar el tope de lectura. */
const relleno = JSON.stringify({ ok: true, data: { relleno: "x".repeat(20_000) } });
const servidor = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(relleno, { headers: { "content-type": "application/json" } }),
});

afterAll(() => {
  servidor.stop(true);
});

function configDelServidor(maxResponseBytes: number): BridgeConfig {
  return {
    host: "127.0.0.1",
    port: servidor.port!,
    readOnly: true,
    unsafeActions: false,
    allowAllCommands: false,
    allowCommands: [],
    timeoutMs: 5_000,
    maxResponseBytes,
  };
}

describe("tope de respuesta del bridge", () => {
  test("corta una respuesta que pasa del tope sin materializarla entera", async () => {
    const cliente = new BridgeTransportClient(configDelServidor(1_024));

    const resultado = await cliente.ping();

    expect(resultado.ok).toBe(false);
    expect(resultado.error?.code).toBe("BRIDGE_RESPONSE_TOO_LARGE");
    expect(resultado.error?.message).toContain("tope es 1024");
  });

  test("lee la respuesta cuando cabe en el tope", async () => {
    const cliente = new BridgeTransportClient(configDelServidor(64 * 1024));

    const resultado = await cliente.ping();

    expect(resultado.ok).toBe(true);
    expect((resultado.data as { ok?: boolean } | undefined)?.ok).toBe(true);
  });
});
