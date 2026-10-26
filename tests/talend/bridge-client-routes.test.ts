import { afterEach, describe, expect, test } from "bun:test";
import type { BridgeConfig } from "../../src/modules/studio-bridge/adapters/bridge-config";
import { TalendStudioBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";

type Llamada = { url: string; method?: string; headers?: Record<string, string>; body?: string };

const config: BridgeConfig = {
  host: "127.0.0.1",
  port: 3930,
  readOnly: false,
  unsafeActions: false,
  allowAllCommands: false,
  allowCommands: [],
  timeoutMs: 1_000,
};

const originalFetch = globalThis.fetch;
let llamadas: Llamada[] = [];
let responder: (llamada: Llamada) => { status?: number; statusText?: string; body?: string } = () => ({ body: "{}" });

function cliente(token?: string): TalendStudioBridgeClient {
  return new TalendStudioBridgeClient(config, token);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  llamadas = [];
  responder = () => ({ body: "{}" });
});

function interceptar(): void {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const llamada: Llamada = {
      url: String(input),
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    llamadas.push(llamada);
    const respuesta = responder(llamada);
    return new Response(respuesta.body ?? "{}", {
      status: respuesta.status ?? 200,
      statusText: respuesta.statusText,
    });
  }) as typeof fetch;
}

describe("cliente HTTP del bridge", () => {
  test("hace ping sin token y marca el origen studio-bridge", async () => {
    interceptar();
    responder = () => ({ body: JSON.stringify({ ok: true, plugin: "bridge", version: "1", mode: "read" }) });

    const resultado = await cliente("secreto").ping();

    expect(resultado.ok).toBe(true);
    expect(resultado.source).toBe("studio-bridge");
    expect(resultado.data?.version).toBe("1");
    expect(llamadas[0]?.url).toBe("http://127.0.0.1:3930/ping");
    expect(llamadas[0]?.method).toBe("GET");
    expect(llamadas[0]?.headers?.Authorization).toBeUndefined();
  });

  test("envia el token en las peticiones normales", async () => {
    interceptar();

    await cliente("secreto").workbenchState();

    expect(llamadas[0]?.url).toBe("http://127.0.0.1:3930/workbench/state");
    expect(llamadas[0]?.headers?.Authorization).toBe("Bearer secreto");
  });

  test("codifica el titulo al buscar un editor", async () => {
    interceptar();

    await cliente().findEditor("Job ventas & cobros");

    expect(llamadas[0]?.url).toBe(
      "http://127.0.0.1:3930/workbench/find-editor?titleContains=Job%20ventas%20%26%20cobros",
    );
  });

  test("manda cuerpo JSON en las operaciones POST de cada area", async () => {
    interceptar();
    const clienteHttp = cliente();

    await clienteHttp.addNode({ type: "tJoin", label: "join" });
    await clienteHttp.jobContexts({ job: "miJob" });
    await clienteHttp.coverageStatus({ cancel: true });
    await clienteHttp.memory({ gc: true });

    expect(llamadas.map((llamada) => `${llamada.method} ${new URL(llamada.url).pathname}`)).toEqual([
      "POST /automation/nodes/add",
      "POST /automation/job/contexts",
      "POST /automation/coverage/status",
      "POST /automation/memory",
    ]);
    expect(JSON.parse(llamadas[0]!.body!)).toMatchObject({ type: "tJoin", label: "join" });
    expect(JSON.parse(llamadas[1]!.body!)).toEqual({ job: "miJob" });
    expect(llamadas[0]?.headers?.["Content-Type"]).toBe("application/json");
  });

  test("convierte un error HTTP en un resultado con el mensaje del bridge", async () => {
    interceptar();
    responder = () => ({ status: 500, statusText: "Server Error", body: JSON.stringify({ error: { message: "boom" } }) });

    const resultado = await cliente().createJob({ name: "job" });

    expect(resultado.ok).toBe(false);
    expect(resultado.status).toBe(500);
    expect(resultado.error?.code).toBe("HTTP_500");
    expect(resultado.error?.message).toBe("boom");
  });

  test("no propaga la excepcion si el bridge no responde", async () => {
    interceptar();
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as unknown as typeof fetch;

    const resultado = await cliente().ping();

    expect(resultado.ok).toBe(false);
    expect(resultado.error?.code).toBe("BRIDGE_UNAVAILABLE");
    expect(resultado.error?.message).toContain("ECONNREFUSED");
  });

  test("conserva el texto crudo cuando la respuesta no es JSON", async () => {
    interceptar();
    responder = () => ({ body: "sin json" });

    const resultado = await cliente().capabilities();

    expect(resultado.ok).toBe(true);
    expect(resultado.data as Record<string, unknown>).toEqual({ rawText: "sin json" });
  });
});
