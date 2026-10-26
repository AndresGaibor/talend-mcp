import { describe, expect, test } from "bun:test";
import {
  checkStudioDialogs,
  classifyStudioDialog,
  isBlockingDialog,
  parseStudioDialogs,
} from "../../src/talend/studio/studio-dialogs";
import type { TalendStudioBridgeClient } from "../../src/talend/studio/bridge-client";

/**
 * Dialogos abiertos en Studio: que tipo son y cuales bloquean el IDE. Un
 * dialogo modal bloquea; un progreso normal o un shell no modal no.
 */
describe("classifyStudioDialog", () => {
  test("reconoce los dialogos que el bridge ya conoce", () => {
    expect(classifyStudioDialog("Third party modules")).toBe("missing_modules");
    expect(classifyStudioDialog("Modulos de terceros")).toBe("missing_modules");
    expect(classifyStudioDialog("Jobname Error")).toBe("job_name");
    expect(classifyStudioDialog("Invalid Job Name")).toBe("job_name");
    expect(classifyStudioDialog("Save Resource")).toBe("save_resource");
    expect(classifyStudioDialog("Guardar recursos")).toBe("save_resource");
  });

  test("los progresos normales no son bloqueantes por su titulo", () => {
    expect(classifyStudioDialog("Building job MCP_X")).toBe("progress");
    expect(classifyStudioDialog("Cargando proyecto")).toBe("progress");
  });

  test("lo que no se conoce queda como unknown", () => {
    expect(classifyStudioDialog("Acerca de Talend")).toBe("unknown");
  });
});

describe("isBlockingDialog", () => {
  test("un dialogo modal de tipo desconocido bloquea", () => {
    expect(isBlockingDialog({ modal: true, kind: "unknown" })).toBe(true);
  });

  test("un progreso modal no bloquea: es trabajo normal de Studio", () => {
    expect(isBlockingDialog({ modal: true, kind: "progress" })).toBe(false);
  });

  test("un shell no modal no bloquea aunque sea de tipo conocido", () => {
    expect(isBlockingDialog({ modal: false, kind: "job_name" })).toBe(false);
  });
});

describe("parseStudioDialogs", () => {
  test("clasifica y da la accion sugerida de cada dialogo", () => {
    const [dialog] = parseStudioDialogs({
      dialogs: [{ title: "Jobname Error", modal: true, buttons: ["Yes", "No"], texts: ["Etiqueta en uso"] }],
    });
    expect(dialog).toMatchObject({ kind: "job_name", blocking: true, buttons: ["Yes", "No"], texts: ["Etiqueta en uso"] });
    expect(dialog?.hint).toContain("Yes");
  });

  test("tolera una respuesta incompleta sin lanzar", () => {
    expect(parseStudioDialogs(undefined)).toEqual([]);
    const [dialog] = parseStudioDialogs({ dialogs: [{ buttons: [42, "OK"] }] });
    expect(dialog).toMatchObject({ title: "", modal: false, kind: "unknown", blocking: false, buttons: ["OK"] });
  });
});

type Reply = { ok: boolean; status?: number; data?: Record<string, unknown>; error?: { code: string; message: string } };

/**
 * Bridge falso. `listDialogs` es el endpoint nativo; `runCode` la sonda de los
 * plugins anteriores. Se cuenta cada llamada para comprobar que no se repite.
 */
function fakeBridge(options: { list: Reply; run?: Reply }) {
  const calls = { list: 0, run: 0 };
  const bridge = {
    listDialogs: async () => {
      calls.list += 1;
      return { ...options.list, source: "studio-bridge", confidence: "high", endpoint: "/workbench/dialogs/list" };
    },
    runCode: async () => {
      calls.run += 1;
      const reply = options.run ?? { ok: false, error: { code: "NO_RUN", message: "sin sonda" } };
      return { ...reply, source: "studio-bridge", confidence: "medium", endpoint: "/automation/run-code" };
    },
  } as unknown as TalendStudioBridgeClient;
  return { bridge, calls };
}

const modalJobName = {
  ok: true,
  data: { ok: true, dialogs: [{ title: "Jobname Error", modal: true, buttons: ["Yes"], texts: [] }] },
};

describe("checkStudioDialogs", () => {
  test("usa el endpoint nativo y bloquea con un dialogo modal que no es progreso", async () => {
    const { bridge, calls } = fakeBridge({ list: modalJobName });
    const check = await checkStudioDialogs(bridge, false);
    expect(check.status).toBe("blocked");
    expect(check.status !== "unavailable" ? check.blocking.map((dialog) => dialog.kind) : []).toEqual(["job_name"]);
    expect(calls).toEqual({ list: 1, run: 0 });
  });

  test("con ignoreDialogs deja pasar, pero sigue listando lo que hay", async () => {
    const { bridge } = fakeBridge({ list: modalJobName });
    const check = await checkStudioDialogs(bridge, true);
    expect(check.status).toBe("clear");
    expect(check.status !== "unavailable" ? check.dialogs : []).toHaveLength(1);
    expect(check.status !== "unavailable" ? check.blocking : []).toHaveLength(1);
  });

  test("sin dialogos esta libre", async () => {
    const { bridge } = fakeBridge({ list: { ok: true, data: { ok: true, dialogs: [] } } });
    expect(await checkStudioDialogs(bridge, false)).toEqual({ status: "clear", dialogs: [], blocking: [] });
  });

  test("con un plugin anterior (404) cae a la sonda Java", async () => {
    const { bridge, calls } = fakeBridge({
      list: { ok: false, status: 404, error: { code: "HTTP_404", message: "404" } },
      run: { ok: true, data: { ok: true, result: { dialogs: [{ title: "Jobname Error", modal: true, buttons: [], texts: [] }] } } },
    });
    const check = await checkStudioDialogs(bridge, false);
    expect(check.status).toBe("blocked");
    expect(calls).toEqual({ list: 1, run: 1 });
  });

  test("un error que no es de plugin antiguo no se oculta: unavailable, sin sonda", async () => {
    const { bridge, calls } = fakeBridge({ list: { ok: false, error: { code: "BRIDGE_DOWN", message: "conexion rechazada" } } });
    const check = await checkStudioDialogs(bridge, false);
    expect(check.status).toBe("unavailable");
    expect(calls.run).toBe(0);
  });

  test("con plugin anterior y sin unsafeActions no bloquea: unavailable con el motivo", async () => {
    const { bridge } = fakeBridge({
      list: { ok: false, status: 404, error: { code: "HTTP_404", message: "404" } },
      run: { ok: false, error: { code: "UNSAFE_ACTIONS_DISABLED", message: "unsafeActions=false" } },
    });
    const check = await checkStudioDialogs(bridge, false);
    expect(check.status).toBe("unavailable");
  });
});
