import { describe, expect, test } from "bun:test";

import { renderBridgeStatus, type BridgeStatus } from "../../scripts/lib/bridge-status";
import { isBundleSourceChange } from "../../scripts/lib/bridge-watch";

const LIVE = "0.1.0.20261026194843";

function estado(overrides: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    studio: {
      dir: "C:/Talend/8.0.1/studio",
      jdk: "C:/Talend/8.0.1/zulu21",
      javaVersion: "21",
      installedVersion: LIVE,
    },
    studioRunning: true,
    bridge: {
      port: 3930,
      ping: { plugin: "com.andres.talend.bridge", version: LIVE, mode: "readWrite", pid: 4242, uptimeMs: 90_000 },
    },
    localBuild: { built: true, upToDate: true, version: LIVE },
    hotJar: { path: "C:/Users/x/.talend-bridge/hot/bridge.jar", modifiedAt: new Date(2026, 9, 26, 19, 48) },
    config: { path: "C:/Users/x/.talend-bridge/config.json", exists: true, tokenExists: true },
    ...overrides,
  };
}

describe("estado del bridge en texto", () => {
  test("muestra version en vivo, modo y build al dia cuando todo coincide", () => {
    const text = renderBridgeStatus(estado()).join("\n");

    expect(text).toContain(`${LIVE} · readWrite · pid 4242`);
    expect(text).toContain(`${LIVE} (al dia)`);
    expect(text).not.toContain("Aviso");
  });

  test("avisa cuando el bridge en vivo no tiene el ultimo build al dia", () => {
    const text = renderBridgeStatus(
      estado({ localBuild: { built: true, upToDate: true, version: "0.1.0.20261026203000" } }),
    ).join("\n");

    expect(text).toContain("Aviso: el bridge en vivo no tiene el ultimo build");
  });

  test("marca el build como desactualizado si las fuentes cambiaron", () => {
    const text = renderBridgeStatus(estado({ localBuild: { built: true, upToDate: false, version: LIVE } })).join("\n");

    expect(text).toContain("cambios sin compilar");
    expect(text).toContain("--watch-bridge");
  });

  test("sin bridge que responda lo dice y no inventa una version", () => {
    const text = renderBridgeStatus(
      estado({ studioRunning: false, bridge: { port: 3930, ping: null } }),
    ).join("\n");

    expect(text).toContain("no responde en http://127.0.0.1:3930");
    expect(text).toContain("cerrado");
    expect(text).not.toContain("pid");
  });

  test("un plugin antiguo que no manda pid ni tiempo activo no muestra esos datos inventados", () => {
    const text = renderBridgeStatus(
      estado({ bridge: { port: 3930, ping: { plugin: "com.andres.talend.bridge", version: LIVE } } }),
    ).join("\n");

    expect(text).toContain(`Bridge en vivo      ${LIVE}`);
    expect(text).not.toContain("pid");
    expect(text).not.toContain("activo");
  });

  test("sin Talend Studio indica como definirlo", () => {
    const text = renderBridgeStatus(estado({ studio: null, studioRunning: false })).join("\n");

    expect(text).toContain("define TALEND_STUDIO_HOME");
  });

  test("sin jar publicado y sin build lo dice claramente", () => {
    const text = renderBridgeStatus(
      estado({
        localBuild: { built: false, upToDate: false },
        hotJar: { path: "x/bridge.jar", modifiedAt: null },
      }),
    ).join("\n");

    expect(text).toContain("no compilado (ejecuta --install-bridge)");
    expect(text).toContain("sin publicar");
  });
});

describe("cambios que disparan la recarga (--watch-bridge)", () => {
  test("acepta las fuentes, el MANIFEST y plugin.xml del bundle", () => {
    expect(isBundleSourceChange("src/com/andres/talend/bridge/BridgeServer.java")).toBe(true);
    expect(isBundleSourceChange("META-INF/MANIFEST.MF")).toBe(true);
    expect(isBundleSourceChange("plugin.xml")).toBe(true);
  });

  test("ignora la salida de compilacion, los temporales y los archivos del IDE", () => {
    expect(isBundleSourceChange("target/fast/build.json")).toBe(false);
    expect(isBundleSourceChange("bin/com/andres/x.class")).toBe(false);
    expect(isBundleSourceChange(".settings/org.eclipse.core.resources.prefs")).toBe(false);
    expect(isBundleSourceChange("src/Foo.java.swp")).toBe(false);
    expect(isBundleSourceChange("src/Foo.java~")).toBe(false);
    expect(isBundleSourceChange("build.properties")).toBe(false);
    expect(isBundleSourceChange(null)).toBe(false);
  });

  test("acepta rutas con separadores de Windows", () => {
    expect(isBundleSourceChange("src\\com\\andres\\talend\\bridge\\Activator.java")).toBe(true);
  });
});
