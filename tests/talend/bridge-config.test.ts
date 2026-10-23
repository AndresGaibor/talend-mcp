import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readTalendStudioBridgeConfig, readTalendStudioBridgeToken } from "../../src/modules/studio-bridge/adapters/bridge-config";
import { clearBridgeClientCache, createBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";

const originalEnv = {
  config: process.env.TALEND_BRIDGE_CONFIG,
  host: process.env.TALEND_BRIDGE_HOST,
  port: process.env.TALEND_BRIDGE_PORT,
  token: process.env.TALEND_BRIDGE_TOKEN,
};
const tempDirs: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "talend-bridge-config-"));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  clearBridgeClientCache();
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
  for (const [name, value] of [
    ["TALEND_BRIDGE_CONFIG", originalEnv.config],
    ["TALEND_BRIDGE_HOST", originalEnv.host],
    ["TALEND_BRIDGE_PORT", originalEnv.port],
    ["TALEND_BRIDGE_TOKEN", originalEnv.token],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("configuracion del cliente del bridge", () => {
  test("combina la configuracion JSON con los overrides del entorno", async () => {
    const file = join(temporaryDirectory(), "bridge.json");
    writeFileSync(file, JSON.stringify({ port: 3940, unsafeActions: true }), "utf8");
    process.env.TALEND_BRIDGE_CONFIG = file;
    process.env.TALEND_BRIDGE_HOST = "localhost";
    process.env.TALEND_BRIDGE_PORT = "3950";

    await expect(readTalendStudioBridgeConfig()).resolves.toMatchObject({
      host: "localhost",
      port: 3950,
      readOnly: true,
      unsafeActions: true,
      allowCommands: ["org.eclipse.ui.file.save", "org.eclipse.ui.file.saveAll"],
    });
  });

  test("lee el token del archivo indicado por el entorno y elimina espacios", async () => {
    const file = join(temporaryDirectory(), "bridge.token");
    writeFileSync(file, "  test-token\r\n", "utf8");
    process.env.TALEND_BRIDGE_TOKEN = file;

    await expect(readTalendStudioBridgeToken()).resolves.toBe("test-token");
  });

  test("reutiliza el cliente predeterminado y comparte su creacion concurrente", async () => {
    const file = join(temporaryDirectory(), "bridge.json");
    writeFileSync(file, JSON.stringify({ port: 3947 }), "utf8");
    process.env.TALEND_BRIDGE_CONFIG = file;

    const [first, concurrent] = await Promise.all([createBridgeClient(), createBridgeClient()]);
    const subsequent = await createBridgeClient();

    expect(first).toBe(concurrent);
    expect(first).toBe(subsequent);
    expect(first.getConfig().port).toBe(3947);
  });

  test("permite invalidar el cliente para recoger cambios de configuracion", async () => {
    const file = join(temporaryDirectory(), "bridge.json");
    writeFileSync(file, JSON.stringify({ port: 3948 }), "utf8");
    process.env.TALEND_BRIDGE_CONFIG = file;

    const first = await createBridgeClient();
    writeFileSync(file, JSON.stringify({ port: 3949 }), "utf8");
    clearBridgeClientCache();
    const refreshed = await createBridgeClient();

    expect(refreshed).not.toBe(first);
    expect(refreshed.getConfig().port).toBe(3949);
  });
});
