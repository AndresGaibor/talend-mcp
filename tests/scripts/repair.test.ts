import { describe, expect, test } from "bun:test";
import type { StudioInstall } from "../../scripts/lib/studio-detect";
import {
  planSafeConfig,
  repair,
  type RepairDeps,
  type RepairReporter,
} from "../../src/cli/repair-command";

/**
 * La reparacion se prueba con dependencias falsas: no debe abrir Studio, ni lanzar p2, ni tocar el
 * registro de tareas durante los tests.
 */

const studio: StudioInstall = {
  dir: "C:/Talend/8.0.1",
  exe: "C:/Talend/8.0.1/studio/TalendStudio.exe",
  jdk: "C:/Talend/8.0.1/jdk",
  studioDir: "C:/Talend/8.0.1/studio",
};

function reporter(messages: string[]): RepairReporter {
  const push = (prefix: string) => (message: string) => messages.push(`${prefix}: ${message}`);
  return { step: push("step"), ok: push("ok"), info: push("info"), warn: push("warn"), fail: push("fail") };
}

function baseDeps(messages: string[], overrides: Partial<RepairDeps> = {}): RepairDeps {
  return {
    home: "C:/Users/prueba",
    detectStudio: () => studio,
    isStudioRunning: async () => false,
    installedFeature: () => "0.1.0.202610280437",
    installedJar: () => "0.1.0.202610280437",
    installPlugin: async () => 0,
    runningVersion: async () => null,
    readConfig: () => null,
    writeConfig: () => {},
    supervisorInstalled: () => false,
    removeSupervisor: () => true,
    stopSupervisor: () => 0,
    clearHotJar: () => false,
    report: reporter(messages),
    ...overrides,
  };
}

describe("planSafeConfig", () => {
  test("un archivo ausente deja autoDismissModals=false escrito", () => {
    const plan = planSafeConfig(null);
    expect(plan.changed).toBe(true);
    expect(plan.text).toContain('"autoDismissModals": false');
  });

  test("apaga el guardian y conserva el resto de la configuracion", () => {
    const plan = planSafeConfig(JSON.stringify({ port: 4040, autoDismissModals: true, timeoutMs: 90000 }));
    expect(plan.changed).toBe(true);
    expect(plan.autoDismiss).toBe(true);
    const data = JSON.parse(plan.text!);
    expect(data).toMatchObject({ port: 4040, autoDismissModals: false, timeoutMs: 90000 });
  });

  test("no reescribe si ya esta apagado", () => {
    const plan = planSafeConfig('{"autoDismissModals":false}');
    expect(plan.changed).toBe(false);
    expect(plan.autoDismiss).toBe(false);
  });

  test("un JSON corrupto no se sobrescribe", () => {
    const plan = planSafeConfig("{ roto");
    expect(plan.changed).toBe(false);
    expect(plan.text).toBeNull();
    expect(plan.error).toBeDefined();
  });
});

describe("repair", () => {
  test("con Studio cerrado deja el plugin instalado, apaga el guardian y quita el supervisor", async () => {
    const messages: string[] = [];
    let config = JSON.stringify({ port: 3930, autoDismissModals: true });
    let guardado = "";
    let calienteBorrado = 0;

    const result = await repair(
      baseDeps(messages, {
        readConfig: () => config,
        writeConfig: (_path, text) => {
          guardado = text;
          config = text;
        },
        supervisorInstalled: () => true,
        removeSupervisor: () => true,
        stopSupervisor: () => 2,
        clearHotJar: () => {
          calienteBorrado++;
          return true;
        },
        installedFeature: () => "0.1.0.202611251200",
        installedJar: () => "0.1.0.202611251200",
        installPlugin: async () => 0,
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.pendingStudioRestart).toBe(false);
    expect(result.actions).toEqual(["config", "supervisor", "plugin"]);
    expect(JSON.parse(guardado).autoDismissModals).toBe(false);
    expect(calienteBorrado).toBe(1);
    expect(messages.some((line) => line.startsWith("ok: Tarea TalendMcpSupervisor eliminada"))).toBe(true);
  });

  test("con Studio abierto avisa que p2 queda pendiente y no borra el jar en caliente", async () => {
    const messages: string[] = [];
    let calienteBorrado = 0;

    const result = await repair(
      baseDeps(messages, {
        isStudioRunning: async () => true,
        installedFeature: () => "0.1.0.202610280437",
        installedJar: () => "0.1.0.202610280437",
        runningVersion: async () => "0.1.0.202611251200",
        clearHotJar: () => {
          calienteBorrado++;
          return true;
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.pendingStudioRestart).toBe(true);
    expect(result.running).toBe("0.1.0.202611251200");
    expect(calienteBorrado).toBe(0);
    expect(messages.some((line) => line.includes("Cierra Talend Studio"))).toBe(true);
  });

  test("si p2 deja el feature sin jar, la reparacion falla", async () => {
    const messages: string[] = [];
    const result = await repair(
      baseDeps(messages, {
        installedFeature: () => "0.1.0.202611251200",
        installedJar: () => null,
      }),
    );

    expect(result.ok).toBe(false);
    expect(messages.some((line) => line.includes("falta el jar"))).toBe(true);
  });

  test("sin Studio sigue apagando el guardian y sale bien", async () => {
    const messages: string[] = [];
    let escrito = false;
    const result = await repair(
      baseDeps(messages, {
        detectStudio: () => null,
        readConfig: () => '{"autoDismissModals":true}',
        writeConfig: () => {
          escrito = true;
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(escrito).toBe(true);
    expect(result.installed).toBeNull();
    expect(messages.some((line) => line.includes("No se detecto Talend Studio"))).toBe(true);
  });

  test("--dry-run no escribe, no quita el supervisor y no instala", async () => {
    const messages: string[] = [];
    let escrituras = 0;
    let eliminados = 0;
    let instalaciones: Array<{ from?: string; dryRun: boolean }> = [];

    const result = await repair(
      baseDeps(messages, {
        readConfig: () => '{"autoDismissModals":true}',
        writeConfig: () => {
          escrituras++;
        },
        supervisorInstalled: () => true,
        removeSupervisor: () => {
          eliminados++;
          return true;
        },
        stopSupervisor: () => 1,
        installPlugin: async (options) => {
          instalaciones.push(options);
          return 0;
        },
      }),
      { dryRun: true, from: "C:/repo" },
    );

    expect(result.ok).toBe(true);
    expect(escrituras).toBe(0);
    expect(eliminados).toBe(0);
    expect(instalaciones).toEqual([{ from: "C:/repo", dryRun: true }]);
    expect(messages.some((line) => line.includes("Simulacion"))).toBe(true);
  });

  test("--keep-supervisor conserva la tarea", async () => {
    const messages: string[] = [];
    let eliminados = 0;
    const result = await repair(
      baseDeps(messages, {
        supervisorInstalled: () => true,
        removeSupervisor: () => {
          eliminados++;
          return true;
        },
      }),
      { keepSupervisor: true },
    );

    expect(result.ok).toBe(true);
    expect(eliminados).toBe(0);
    expect(messages.some((line) => line.includes("Se conserva el supervisor"))).toBe(true);
  });

  test("si la instalacion del plugin falla, el comando sale con error", async () => {
    const messages: string[] = [];
    const result = await repair(
      baseDeps(messages, {
        installPlugin: async () => 1,
      }),
    );

    expect(result.ok).toBe(false);
    expect(messages.some((line) => line.includes("No se pudo actualizar el plugin"))).toBe(true);
  });
});
