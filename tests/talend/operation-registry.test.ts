import { describe, expect, test } from "bun:test";

import { OperationRegistry } from "../../src/modules/runs/application/operation-registry";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function flushOperations(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("registro de operaciones asíncronas", () => {
  test("expone estado terminal y resultado sin conservar argumentos", async () => {
    const registry = new OperationRegistry();
    const gate = deferred<{ ok: true }>();
    const started = registry.start("build", async () => await gate.promise);

    expect(started.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(registry.status(started.operationId)?.state).toBe("queued");
    await flushOperations();
    expect(registry.status(started.operationId)?.state).toBe("running");
    gate.resolve({ ok: true });
    await flushOperations();
    expect(registry.status(started.operationId)).toMatchObject({ state: "succeeded", result: { ok: true } });
  });

  test("envía cancelación cooperativa y confirma estado cancelado", async () => {
    const registry = new OperationRegistry();
    const startedSignal = deferred<AbortSignal>();
    const started = registry.start("run", async (signal) => {
      startedSignal.resolve(signal);
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      return { ok: false, cancelled: true };
    });

    const signal = await startedSignal.promise;
    expect(signal.aborted).toBe(false);
    expect(registry.cancel(started.operationId)?.state).toBe("cancelling");
    await flushOperations();
    expect(signal.aborted).toBe(true);
    expect(registry.status(started.operationId)?.state).toBe("cancelled");
  });

  test("marca errores y resultados fallidos como terminales", async () => {
    const registry = new OperationRegistry();
    const failed = registry.start("run", async () => ({ ok: false }));
    await flushOperations();
    expect(registry.status(failed.operationId)).toMatchObject({ state: "failed", errorCode: "RUN_FAILED" });

    const thrown = registry.start("run", async () => { throw new Error("secreto que no se guarda"); });
    await flushOperations();
    expect(registry.status(thrown.operationId)).toMatchObject({ state: "failed", errorCode: "OPERATION_FAILED" });
  });

  test("actualiza el progreso visible de una operación activa", async () => {
    const registry = new OperationRegistry();
    const gate = deferred<{ ok: true }>();
    const started = registry.start("build", async () => await gate.promise);
    await flushOperations();

    registry.updateProgress(started.operationId, { completed: 2, total: 5, currentJob: "JOB_3" });
    expect(registry.status(started.operationId)?.progress).toEqual({ completed: 2, total: 5, currentJob: "JOB_3" });
    gate.resolve({ ok: true });
    await flushOperations();
  });

  test("limita las operaciones activas para no saturar el equipo", () => {
    const registry = new OperationRegistry();
    const operations = Array.from({ length: 4 }, () => registry.start("run", async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      return { ok: false, cancelled: true };
    }));
    expect(() => registry.start("run", async () => ({ ok: true }))).toThrow("límite de operaciones activas");
    for (const operation of operations) registry.cancel(operation.operationId);
  });
});
