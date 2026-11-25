import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { planBridgeUninstall, uninstallBridge } from "../../scripts/uninstall-bridge";
import type { StudioInstall } from "../../scripts/lib/studio-detect";

/**
 * `bridge uninstall` y los desinstaladores: el plugin de Studio no se va con borrar los datos
 * locales, se quita con p2 y con Studio cerrado. La decision se prueba sin Studio; la llamada a
 * p2 se sustituye para no tocar una instalacion real.
 */

const ROOT = join(import.meta.dir, "..", "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

// Carpeta temporal: la desinstalacion real limpia jars sueltos. Si el doble usara una ruta real,
// ejecutar los tests borraria el plugin de la instalacion de Studio de esta maquina.
const studioDir = mkdtempSync(join(tmpdir(), "talend-uninstall-bridge-"));
const studio: StudioInstall = {
  dir: studioDir,
  exe: join(studioDir, "studio.exe"),
  jdk: join(studioDir, "jdk"),
  studioDir,
};

afterAll(() => {
  rmSync(studioDir, { recursive: true, force: true });
});

let exitCodeOriginal: typeof process.exitCode;

beforeEach(() => {
  exitCodeOriginal = process.exitCode;
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = exitCodeOriginal;
});

describe("planBridgeUninstall", () => {
  test("sin plugin instalado no hay nada que hacer", () => {
    expect(planBridgeUninstall({ installed: null, studioRunning: false, dryRun: false })).toEqual({
      action: "nada",
      version: null,
    });
  });

  test("con --dry-run solo simula", () => {
    expect(planBridgeUninstall({ installed: "0.1.0.1", studioRunning: false, dryRun: true })).toEqual({
      action: "simular",
      version: "0.1.0.1",
    });
  });

  test("con Studio abierto pide cerrarlo antes de tocar p2", () => {
    expect(planBridgeUninstall({ installed: "0.1.0.1", studioRunning: true, dryRun: false }).action).toBe("cerrar-studio");
  });

  test("con Studio cerrado desinstala", () => {
    expect(planBridgeUninstall({ installed: "0.1.0.1", studioRunning: false, dryRun: false }).action).toBe("quitar");
  });
});

describe("uninstallBridge", () => {
  test("quita el plugin con p2 y confirma que ya no esta", async () => {
    const llamadas: string[] = [];
    let instalado: string | null = "0.1.0.1";
    await uninstallBridge({
      studio,
      isRunning: async () => false,
      installedVersion: () => instalado,
      remove: (_studio, data) => {
        llamadas.push(data);
        instalado = null;
        return true;
      },
    });

    expect(llamadas).toHaveLength(1);
    expect(process.exitCode ?? 0).toBe(0);
  });

  test("no llama a p2 si Studio esta abierto", async () => {
    let llamado = false;
    await uninstallBridge({
      studio,
      isRunning: async () => true,
      installedVersion: () => "0.1.0.1",
      remove: () => {
        llamado = true;
        return true;
      },
    });

    expect(llamado).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  test("si p2 no lo quita, termina en error", async () => {
    await uninstallBridge({
      studio,
      isRunning: async () => false,
      installedVersion: () => "0.1.0.1",
      remove: () => false,
    });

    expect(process.exitCode).toBe(1);
  });

  test("con --dry-run no toca p2", async () => {
    let llamado = false;
    await uninstallBridge({
      dryRun: true,
      studio,
      isRunning: async () => false,
      installedVersion: () => "0.1.0.1",
      remove: () => {
        llamado = true;
        return true;
      },
    });

    expect(llamado).toBe(false);
    expect(process.exitCode ?? 0).toBe(0);
  });
});

describe("el comando y los desinstaladores encadenan la desinstalacion", () => {
  test("la CLI expone bridge uninstall", () => {
    const cli = read("src/cli/bridge-command.ts");
    expect(cli).toContain('opts.action === "uninstall"');
    expect(cli).toContain("scripts/uninstall-bridge");
    expect(read("src/cli/main.ts")).toContain("bridge uninstall");
  });

  test("los desinstaladores quitan el plugin antes de borrar el binario", () => {
    const ps1 = read("scripts/install/uninstall.ps1");
    expect(ps1).toContain("& $exe bridge uninstall");
    expect(ps1.indexOf("& $exe bridge uninstall")).toBeLessThan(ps1.indexOf("Remove-Item $root"));

    const sh = read("scripts/install/uninstall.sh");
    expect(sh).toContain('"$EXE" bridge uninstall');
    expect(sh.indexOf('"$EXE" bridge uninstall')).toBeLessThan(sh.indexOf('rm -rf "$ROOT"'));
  });
});
