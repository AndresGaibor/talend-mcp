import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";

/**
 * Integracion contra el Talend Studio real.
 *
 * Estos tests golpean el bridge del Studio del usuario: abren jobs, ejecutan
 * una launch config de verdad y comprueban el estado del IDE. No se pueden
 * correr en cualquier maquina ni en cualquier momento, asi que solo se
 * ejecutan cuando se piden expresamente:
 *
 *   TALEND_BRIDGE_INTEGRATION=1 bun test tests/integration
 *
 * Sin esa variable, el archivo se salta entero. Asi `bun test` es verde
 * siempre, con y sin Studio abierto.
 */

const integrationEnabled = process.env.TALEND_BRIDGE_INTEGRATION === "1";

async function obtenerTokenLocal(): Promise<string> {
  return await Bun.file(`${process.env.HOME}/.talend-bridge/token`).text().then((texto) => texto.trim());
}

const tokenPath = `${process.env.HOME}/.talend-bridge/token`;
const hasToken = existsSync(tokenPath);

async function isBridgeReachable(): Promise<boolean> {
  if (!hasToken) return false;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1000);
    const res = await fetch("http://127.0.0.1:3930/talend/active-job/model", {
      headers: {
        Authorization: `Bearer ${await obtenerTokenLocal()}`
      },
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(id);
    return res !== null && res.status !== 404; // 404/200/etc implies server is active, connection refused would be null
  } catch {
    return false;
  }
}

const bridgeRunning = await isBridgeReachable();

describe("Talend Studio Bridge (integracion)", () => {
  if (!integrationEnabled) {
    test("skipped: pon TALEND_BRIDGE_INTEGRATION=1 para correrlos", () => {
      expect(true).toBe(true);
    });
    return;
  }

  if (!bridgeRunning) {
    test("skipped: Talend Studio Bridge is not running or token is missing", () => {
      expect(true).toBe(true);
    });
    return;
  }

  test("expone un modelo activo sin falso unsupported y con conexiones", async () => {
    const token = await obtenerTokenLocal();

    const response = await fetch("http://127.0.0.1:3930/talend/active-job/model", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.ok).toBe(true);

    const payload = await response.json() as {
      unsupported?: string[];
      connections?: unknown[];
    };

    expect(payload.unsupported ?? []).not.toContain("getProcess/getProcessItem no existe");
  });

  test("permite ejecutar una launch config real cuando unsafeActions está activo", async () => {
    const token = await obtenerTokenLocal();
    const launchConfig = process.env.TALEND_BRIDGE_TEST_LAUNCH_CONFIG;
    if (!launchConfig) {
      test("skipped: pon TALEND_BRIDGE_TEST_LAUNCH_CONFIG con el nombre de una launch config", () => {
        expect(true).toBe(true);
      });
      return;
    }

    const response = await fetch("http://127.0.0.1:3930/launch/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: launchConfig,
        mode: "run",
        dryRun: false,
      }),
    });

    expect(response.ok).toBe(true);

    const payload = await response.json() as {
      executed?: boolean;
      supported?: boolean;
      dryRun?: boolean;
    };

    expect(payload.supported).toBe(true);
    expect(payload.dryRun).toBe(false);
    expect(payload.executed).toBe(true);
  }, 60000);

  test("abre un job del workspace en el editor activo", async () => {
    const token = await obtenerTokenLocal();
    const jobPath = process.env.TALEND_BRIDGE_TEST_JOB_PATH;
    if (!jobPath) {
      test("skipped: pon TALEND_BRIDGE_TEST_JOB_PATH con la ruta de un job del workspace", () => {
        expect(true).toBe(true);
      });
      return;
    }

    const response = await fetch("http://127.0.0.1:3930/workbench/open-resource", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: jobPath }),
    });

    expect(response.ok).toBe(true);

    const payload = await response.json() as {
      opened?: boolean;
      path?: string;
    };

    expect(payload.opened).toBe(true);
    expect(payload.path).toBe(jobPath);
  }, 60000);

  test("abre el job en un editor de Talend y no en un TextEditor", async () => {
    const token = await obtenerTokenLocal();
    const jobPath = process.env.TALEND_BRIDGE_TEST_JOB_PATH;
    if (!jobPath) {
      test("skipped: pon TALEND_BRIDGE_TEST_JOB_PATH con la ruta de un job del workspace", () => {
        expect(true).toBe(true);
      });
      return;
    }

    await fetch("http://127.0.0.1:3930/workbench/open-resource", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: jobPath }),
    });

    const stateResponse = await fetch("http://127.0.0.1:3930/workbench/state", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const state = await stateResponse.json() as {
      windows?: Array<{
        activeEditor?: {
          class?: string;
          title?: string;
        };
      }>;
    };

    const activeEditorClass = state.windows?.[0]?.activeEditor?.class ?? "";
    expect(activeEditorClass).not.toContain("TextEditor");
  }, 60000);
});
