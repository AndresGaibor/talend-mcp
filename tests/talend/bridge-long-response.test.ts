import { afterAll, describe, expect, test } from "bun:test";
import { BridgeJobClient } from "../../src/modules/studio-bridge/adapters/bridge-job.client";
import type { BridgeConfig } from "../../src/modules/studio-bridge/adapters/bridge-config";

/**
 * Operaciones largas del bridge.
 *
 * El plazo de la configuracion (2,5 s) vale para lecturas. Generar y compilar un
 * Job tarda mas, asi que `build` y `build-batch` llevan su propio plazo; sin el,
 * la peticion se abortaba y el error decia que el bridge estaba caido cuando en
 * realidad estaba trabajando.
 */

const RETRASO_MS = 1_200;

const servidor = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: async (peticion) => {
    await Bun.sleep(RETRASO_MS);
    if (peticion.url.includes("build-batch")) {
      return Response.json({ ok: true, result: { jobs: { job_uno: { ok: true } } } });
    }
    return Response.json({ ok: true, plugin: "talend-studio-bridge", version: "prueba", mode: "readWrite" });
  },
});

afterAll(() => {
  servidor.stop(true);
});

function config(timeoutMs: number): BridgeConfig {
  return {
    host: "127.0.0.1",
    port: servidor.port!,
    readOnly: true,
    unsafeActions: false,
    allowAllCommands: false,
    allowCommands: [],
    timeoutMs,
    maxResponseBytes: 1024 * 1024,
  };
}

describe("operaciones largas del bridge", () => {
  test("un lote que tarda mas que el plazo de lectura se espera y termina bien", async () => {
    // La configuracion da 300 ms: con el plazo corto, el lote se abortaria.
    const cliente = new BridgeJobClient(config(300));

    const resultado = await cliente.jobBuildBatch({ jobs: ["job_uno"] });

    expect(resultado.ok).toBe(true);
    expect((resultado.data as { result?: unknown } | undefined)?.result).toBeDefined();
  }, 10_000);

  test("una lectura lenta se corta en su plazo y no finge exito", async () => {
    const cliente = new BridgeJobClient(config(200));

    const resultado = await cliente.ping();

    expect(resultado.ok).toBe(false);
    expect(resultado.error?.code).toBe("BRIDGE_UNAVAILABLE");
    expect(resultado.error?.message).toContain("no contesto en 200 ms");
    expect(resultado.error?.message).toContain("Se puede reintentar");
    // El error clasificado como timeout prueba que la respuesta no se acepto
    // como exito, sin depender de una cota de reloj sensible a carga del CI.
  }, 10_000);

  test("un lote puede pedir un plazo menor y entonces falla limpio, sin exito falso", async () => {
    const cliente = new BridgeJobClient(config(300));

    const resultado = await cliente.jobBuildBatch({ jobs: ["job_uno"], timeoutMs: 200 });

    expect(resultado.ok).toBe(false);
    expect(resultado.error?.code).toBe("BRIDGE_UNAVAILABLE");
    expect(resultado.data).toBeUndefined();
  }, 10_000);
});
