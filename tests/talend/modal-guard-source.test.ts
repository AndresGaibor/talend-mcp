import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * El plugin Java no se compila en CI (necesita Studio), asi que su comportamiento ante los modales
 * se fija leyendo el codigo: ningun modal se cierra solo salvo `autoDismissModals`, y aun asi solo
 * los conocidos y sin simular teclas.
 */
const PACKAGE = join(
  import.meta.dir,
  "..",
  "..",
  "talend-studio-bridge",
  "com.andres.talend.bridge",
  "src",
  "com",
  "andres",
  "talend",
  "bridge",
);
const read = (relative: string) => readFileSync(join(PACKAGE, relative), "utf8");

describe("guardian de modales del bridge", () => {
  test("el vigilante solo arranca si la configuracion lo pide", () => {
    const activator = read("Activator.java");

    expect(activator).toMatch(/if \(BridgeConfig\.load\(\)\.autoDismissModals\) \{\s*ModalGuard\.startWatchdog\(\);\s*\}/);
    expect(activator.match(/startWatchdog\(\)/g)).toHaveLength(1);
  });

  test("autoDismissModals esta apagado por defecto y se escribe en la configuracion", () => {
    const config = read("BridgeConfig.java");

    expect(config).toContain('readBoolean(root, "autoDismissModals", false)');
    expect(config).toContain('json.addProperty("autoDismissModals", autoDismissModals)');
    expect(config).toMatch(/DEFAULT_TIMEOUT_MS, false\)/);
  });

  test("no pulsa botones en dialogos desconocidos ni los cierra a la fuerza", () => {
    const guard = read("workbench/ModalGuard.java");

    expect(guard).not.toContain("SAFE_BUTTONS");
    expect(guard).not.toContain("safeButtonFor");
    expect(guard).not.toContain("shell.close()");
  });

  test("no simula teclas con java.awt.Robot", () => {
    const guard = read("workbench/ModalGuard.java");

    expect(guard).not.toContain("java.awt.Robot");
    expect(guard).not.toContain("VK_ENTER");
    expect(guard).not.toContain("closeNativeDialog");
  });

  test("solo se pulsa en dialogos de la lista de conocidos", () => {
    const guard = read("workbench/ModalGuard.java");
    const method = guard.slice(guard.indexOf("public static Map<String, Object> dismissBlockingDialogs()"));

    expect(method).toContain("String button = knownButtonFor(shell, title);");
    expect(method).toMatch(/if \(button == null\) \{\s*continue;\s*\}/);
  });
});
