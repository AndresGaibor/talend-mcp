import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { BridgeConfig } from "../../src/modules/studio-bridge/adapters/bridge-config";
import type { BridgeRequestInit, BridgeResult } from "../../src/modules/studio-bridge/adapters/bridge-types";
import {
  BridgeTransportClient,
  clasificarFallo,
  setBridgeRecoveryHook,
} from "../../src/modules/studio-bridge/adapters/bridge-transport";
import { atenderDialogosTrasFallo, reiniciarRecuperacionDeModales } from "../../src/talend/studio/recuperacion-de-bridge";
import type { HandledModal } from "../../src/talend/studio/modals/modal-handler";

let llamadas = 0;
let retrasarSiguiente = false;

const servidor = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch() {
    llamadas++;
    const intento = llamadas;
    if (retrasarSiguiente) {
      retrasarSiguiente = false;
      await Bun.sleep(250);
    }
    return Response.json({ ok: true, intento });
  },
});

afterAll(() => {
  servidor.stop(true);
});

beforeEach(() => {
  llamadas = 0;
  retrasarSiguiente = false;
});

afterEach(() => {
  reiniciarRecuperacionDeModales();
});

const config: BridgeConfig = {
  host: "127.0.0.1",
  port: servidor.port!,
  readOnly: false,
  unsafeActions: false,
  allowAllCommands: false,
  allowCommands: [],
  timeoutMs: 50,
  maxResponseBytes: 1024 * 1024,
};

class ClienteDePrueba extends BridgeTransportClient {
  get<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    return this.request<T>(endpoint, init);
  }

  post<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    return this.request<T>(endpoint, { method: "POST", ...init });
  }
}

const dialogoPulsado = { title: "Error", decision: "pulsar Aceptar", pressed: "Aceptar" };

describe("recuperacion del transporte tras un timeout", () => {
  test("una lectura que expira atiende dialogos y se reintenta una vez", async () => {
    let recuperaciones = 0;
    setBridgeRecoveryHook(async (motivo) => {
      recuperaciones++;
      expect(motivo.codigo).toBe("timeout");
      return { reintentar: true, dialogos: [dialogoPulsado] };
    });
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).get("/workbench/state");

    expect(resultado.ok).toBe(true);
    expect(llamadas).toBe(2);
    expect(recuperaciones).toBe(1);
    expect(resultado.recovery).toMatchObject({ motivo: "timeout", reintentado: true });
    expect(resultado.warning).toContain("Se atendieron 1 dialogo");
    expect(resultado.warning).toContain("Se reintento la operacion una vez");
  });

  test("una escritura que expira no se reintenta sola aunque se atiendan dialogos", async () => {
    setBridgeRecoveryHook(async () => ({ reintentar: true, dialogos: [dialogoPulsado] }));
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).post("/workbench/dialogs");

    expect(resultado.ok).toBe(false);
    expect(llamadas).toBe(1);
    expect(resultado.recovery).toMatchObject({ reintentado: false });
    expect(resultado.error?.message).toContain("No se reintenta sola una escritura");
    expect(resultado.error?.details).toMatchObject({ recovery: expect.objectContaining({ reintentado: false }) });
  });

  test("una escritura declarada idempotente si se reintenta", async () => {
    setBridgeRecoveryHook(async () => ({ reintentar: true, dialogos: [dialogoPulsado] }));
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).post("/workbench/dialogs", { reintentarTrasModal: true });

    expect(resultado.ok).toBe(true);
    expect(llamadas).toBe(2);
    expect(resultado.recovery?.reintentado).toBe(true);
  });

  test("si no se pulso ningun dialogo no se repite la peticion", async () => {
    setBridgeRecoveryHook(async () => ({ reintentar: false, detalle: "sin dialogos conocidos" }));
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).get("/workbench/state");

    expect(llamadas).toBe(1);
    expect(resultado.recovery).toMatchObject({ reintentado: false, detalle: "sin dialogos conocidos" });
    expect(resultado.error?.message).toContain("sin dialogos conocidos");
  });

  test("la peticion marcada sinRecuperacion no vuelve a llamar al hook", async () => {
    let llamadasAlHook = 0;
    setBridgeRecoveryHook(async () => {
      llamadasAlHook++;
      return { reintentar: true };
    });
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).post("/workbench/dialogs", { sinRecuperacion: true });

    expect(resultado.ok).toBe(false);
    expect(llamadas).toBe(1);
    expect(llamadasAlHook).toBe(0);
  });

  test("si el hook falla, el error original no se pierde", async () => {
    setBridgeRecoveryHook(async () => {
      throw new Error("PowerShell no responde");
    });
    retrasarSiguiente = true;

    const resultado = await new ClienteDePrueba(config).get("/workbench/state");

    expect(resultado.ok).toBe(false);
    expect(resultado.error?.code).toBe("BRIDGE_UNAVAILABLE");
    expect(resultado.recovery?.detalle).toContain("PowerShell no responde");
  });

  test("clasifica timeout y corte de conexion, y descarta un bridge caido", () => {
    const abortado = new Error("The operation was aborted.");
    abortado.name = "AbortError";

    expect(clasificarFallo(abortado)).toBe("timeout");
    expect(clasificarFallo(new Error("The socket connection was closed unexpectedly"))).toBe("conexion-cortada");
    expect(clasificarFallo(new Error("ECONNREFUSED: Unable to connect"))).toBeUndefined();
  });
});

const modalPulsado: HandledModal = {
  title: "Error",
  texts: ["fallo al cargar el job"],
  buttons: ["Aceptar"],
  decision: { kind: "error", action: "press", button: "Aceptar", rule: "error-generico", reason: "" },
  press: { ok: true, pressed: "Aceptar", via: "bm_click", error: null },
};

const modalDeUnaPersona: HandledModal = {
  ...modalPulsado,
  title: "Login",
  decision: { kind: "unknown", action: "leave", rule: "campo-de-contrasena", reason: "Tiene un campo de contrasena" },
  press: undefined,
};

const motivo = { endpoint: "/workbench/state", codigo: "timeout" as const, detalle: "" };

describe("atenderDialogosTrasFallo", () => {
  test("pulsa dialogos conocidos y pide reintentar", async () => {
    const out = await atenderDialogosTrasFallo(motivo, { runtime: "windows", handle: async () => [modalPulsado] });

    expect(out.reintentar).toBe(true);
    expect(out.dialogos).toEqual([{ title: "Error", decision: "pulsar Aceptar", pressed: "Aceptar" }]);
  });

  test("no reintenta si el dialogo necesita una persona", async () => {
    const out = await atenderDialogosTrasFallo(motivo, { runtime: "windows", handle: async () => [modalDeUnaPersona] });

    expect(out.reintentar).toBe(false);
    expect(out.dialogos?.[0]).toMatchObject({ title: "Login", pressed: null });
    expect(out.detalle).toContain("necesita una persona");
  });

  test("lee los dialogos en modo conservador: solo pulsa reglas propias", async () => {
    let opciones: { dryRun?: boolean; onlyKnown?: boolean } | undefined;
    await atenderDialogosTrasFallo(motivo, {
      runtime: "windows",
      handle: async (opts) => {
        opciones = opts;
        return [];
      },
    });

    expect(opciones).toMatchObject({ onlyKnown: true });
  });

  test("en sistemas sin UI Automation no intenta leer dialogos", async () => {
    const out = await atenderDialogosTrasFallo(motivo, { runtime: "linux" });

    expect(out.reintentar).toBe(false);
    expect(out.detalle).toContain("Windows");
  });

  test("se apaga con TALEND_MODALS_AUTO=0", async () => {
    const previo = process.env.TALEND_MODALS_AUTO;
    process.env.TALEND_MODALS_AUTO = "0";
    try {
      const out = await atenderDialogosTrasFallo(motivo, { runtime: "windows", handle: async () => [modalPulsado] });
      expect(out.reintentar).toBe(false);
      expect(out.detalle).toContain("TALEND_MODALS_AUTO");
    } finally {
      if (previo === undefined) delete process.env.TALEND_MODALS_AUTO;
      else process.env.TALEND_MODALS_AUTO = previo;
    }
  });

  test("si la lectura falla, el error queda en el detalle", async () => {
    const out = await atenderDialogosTrasFallo(motivo, {
      runtime: "windows",
      handle: async () => {
        throw new Error("PowerShell no responde");
      },
    });

    expect(out.reintentar).toBe(false);
    expect(out.detalle).toContain("PowerShell no responde");
  });
});
