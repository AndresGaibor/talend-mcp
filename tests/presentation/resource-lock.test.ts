import { describe, expect, test } from "bun:test";

import { clavesDeRecurso, ResourceLockManager } from "../../src/presentation/server/new-server/resource-lock";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("bloqueos por recurso Talend", () => {
  test("serializa la misma clave pero deja avanzar Jobs independientes", async () => {
    const manager = new ResourceLockManager();
    const gate = deferred();
    const firstEntered = deferred();
    const order: string[] = [];

    const first = manager.run(["job:Ventas"], undefined, async () => {
      order.push("primero-inicio");
      firstEntered.resolve();
      await gate.promise;
      order.push("primero-fin");
    });
    await firstEntered.promise;

    let secondEntered = false;
    const second = manager.run(["job:ventas"], undefined, async () => {
      secondEntered = true;
      order.push("segundo");
    });
    await manager.run(["job:clientes"], undefined, async () => { order.push("independiente"); });

    expect(secondEntered).toBe(false);
    expect(order).toEqual(["primero-inicio", "independiente"]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["primero-inicio", "independiente", "primero-fin", "segundo"]);
  });

  test("un lote por patron excluye cambios individuales de Jobs", async () => {
    const manager = new ResourceLockManager();
    const gate = deferred();
    const entered = deferred();
    const batch = manager.run(["job:*"] , undefined, async () => {
      entered.resolve();
      await gate.promise;
    });
    await entered.promise;
    let individualEntered = false;
    const individual = manager.run(["job:ventas"], undefined, async () => { individualEntered = true; });
    expect(individualEntered).toBe(false);
    gate.resolve();
    await Promise.all([batch, individual]);
    expect(individualEntered).toBe(true);
  });

  test("extrae nombres para edición individual, lotes y selección por regex", () => {
    expect(clavesDeRecurso("talend_job_edit", { job: "Ventas" })).toEqual(["job:Ventas"]);
    expect(clavesDeRecurso("talend_jobs_edit_batch", { jobs: ["B", "A"] })).toEqual(["job:B", "job:A"]);
    expect(clavesDeRecurso("talend_jobs_edit_batch", { namePattern: "^MIG_" })).toEqual(["job:*"]);
    expect(clavesDeRecurso("talend_jobs_create_batch", {
      template: { jobName: "MIG_{{table}}" },
      rows: [{ table: "A" }, { table: "B" }],
    })).toEqual(["job:MIG_A", "job:MIG_B"]);
    expect(clavesDeRecurso("talend_upsert_repository_context_parameter", { name: "DEV" })).toEqual(["context:DEV"]);
    expect(clavesDeRecurso("talend_job_context_set", { contextName: "DEV" })).toEqual(["context:DEV", "job:*"]);
  });

  test("serializa herramientas del espacio de Studio con mutaciones de Jobs", () => {
    expect(clavesDeRecurso("talend_bridge_save_all", {})).toEqual(["job:*"]);
    expect(clavesDeRecurso("talend_bridge_execute_command", { command: "refresh" })).toEqual(["job:*"]);
    expect(clavesDeRecurso("talend_studio_handle_modals", { action: "dismiss" })).toEqual(["job:*"]);
  });

  test("bloquea salidas compartidas entre entregables y evidencia aunque cambie el Job", () => {
    expect(clavesDeRecurso("talend_deliverables_create_package", {
      jobName: "Ventas", destinationDir: "./Exports/Release/",
    })).toEqual(["job:Ventas", "output:./exports/release"]);
    expect(clavesDeRecurso("talend_evidence_pack_export", {
      packId: "pack-1", destinationPath: "C:\\Exports\\Release.zip",
    })).toEqual(["output:c:/exports/release.zip"]);
    expect(clavesDeRecurso("talend_mastery_generate_fixture", { componentName: "tMap" }))
      .toEqual(["mastery-fixture:tmap"]);
  });

  test("un directorio de salida compartido serializa dos operaciones independientes", async () => {
    const manager = new ResourceLockManager();
    const firstGate = deferred();
    const firstEntered = deferred();
    const firstKeys = clavesDeRecurso("talend_deliverables_create_package", {
      jobName: "Ventas", destinationDir: "./exports/release",
    });
    const secondKeys = clavesDeRecurso("talend_deliverables_create_package", {
      jobName: "Clientes", destinationDir: "./exports/RELEASE/",
    });
    const first = manager.run(firstKeys, undefined, async () => {
      firstEntered.resolve();
      await firstGate.promise;
    });
    await firstEntered.promise;
    let secondEntered = false;
    const second = manager.run(secondKeys, undefined, async () => { secondEntered = true; });
    expect(secondEntered).toBe(false);
    firstGate.resolve();
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
  });
});
