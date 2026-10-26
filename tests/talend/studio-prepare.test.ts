import { describe, expect, test } from "bun:test";
import { prepareStudioForJob } from "../../src/talend/studio/studio-dialogs";
import type { TalendStudioBridgeClient } from "../../src/talend/studio/bridge-client";

type Listing = Array<{ title: string; modal: boolean; buttons?: string[]; texts?: string[] }>;
type InstallReply = { ok: boolean; data?: Record<string, unknown> };

/**
 * Bridge falso. `listings` son las respuestas de cada llamada a
 * listDialogs, en orden (la ultima se repite). Se cuentan las descargas.
 */
function fakeBridge(listings: Listing[], install: InstallReply = { ok: true, data: { installed: [{ title: "x" }] } }) {
  let listCalls = 0;
  let installCalls = 0;
  const bridge = {
    listDialogs: async () => {
      const dialogs = listings[listCalls] ?? listings[listings.length - 1] ?? [];
      listCalls += 1;
      return { ok: true, source: "studio-bridge", confidence: "high", endpoint: "/workbench/dialogs/list", data: { ok: true, dialogs } };
    },
    installModules: async () => {
      installCalls += 1;
      return { ...install, source: "studio-bridge", confidence: "high", endpoint: "/workbench/modules/install" };
    },
  } as unknown as TalendStudioBridgeClient;
  return { bridge, installs: () => installCalls, lists: () => listCalls };
}

const modules: Listing = [{ title: "Third party modules", modal: true, buttons: ["Cerrar", "Download and install all modules available"] }];
const jobName: Listing = [{ title: "Jobname Error", modal: true, buttons: ["Yes"] }];

describe("prepareStudioForJob", () => {
  test("sin installMissing no toca el dialogo de modulos: lo devuelve bloqueante", async () => {
    const { bridge, installs } = fakeBridge([modules]);
    const prepared = await prepareStudioForJob(bridge, { ignoreDialogs: false, installMissing: false, pollMs: 1 });
    expect(prepared.check.status).toBe("blocked");
    expect(prepared.autoInstalledModules).toBe(false);
    expect(installs()).toBe(0);
  });

  test("con installMissing pulsa la descarga y espera a que Studio quede libre", async () => {
    const { bridge, installs } = fakeBridge([modules, modules, []]);
    const prepared = await prepareStudioForJob(bridge, { ignoreDialogs: false, installMissing: true, pollMs: 1, waitMs: 5000 });
    expect(installs()).toBe(1);
    expect(prepared.autoInstalledModules).toBe(true);
    expect(prepared.check.status).toBe("clear");
  });

  test("un dialogo distinto de modulos nunca se resuelve solo, aunque se pida installMissing", async () => {
    const { bridge, installs } = fakeBridge([jobName]);
    const prepared = await prepareStudioForJob(bridge, { ignoreDialogs: false, installMissing: true, pollMs: 1 });
    expect(installs()).toBe(0);
    expect(prepared.check.status).toBe("blocked");
  });

  test("si la descarga no instala nada no se reintenta y se devuelve el bloqueo", async () => {
    const { bridge, installs } = fakeBridge([modules], { ok: true, data: { installed: [] } });
    const prepared = await prepareStudioForJob(bridge, { ignoreDialogs: false, installMissing: true, pollMs: 1 });
    expect(installs()).toBe(1);
    expect(prepared.autoInstalledModules).toBe(false);
    expect(prepared.check.status).toBe("blocked");
  });

  test("si Studio sigue bloqueado tras esperar, devuelve el bloqueo al cabo de waitMs", async () => {
    const { bridge } = fakeBridge([modules]);
    const started = Date.now();
    const prepared = await prepareStudioForJob(bridge, { ignoreDialogs: false, installMissing: true, pollMs: 5, waitMs: 40 });
    expect(prepared.check.status).toBe("blocked");
    expect(prepared.autoInstalledModules).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });
});
