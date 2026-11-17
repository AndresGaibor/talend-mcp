import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  IdempotencyConflictError,
  IdempotencyOutcomeUnknownError,
  IdempotencyStore,
} from "../../src/presentation/server/new-server/idempotency-store";

const directory = mkdtempSync(join(tmpdir(), "talend-idempotency-"));
const stores: IdempotencyStore[] = [];
function newStore(): IdempotencyStore {
  const store = new IdempotencyStore(directory);
  stores.push(store);
  return store;
}
afterAll(() => {
  for (const store of stores) store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("idempotencia durable de operaciones", () => {
  test("reproduce una respuesta persistida sin volver a ejecutar la escritura", async () => {
    const firstStore = newStore();
    let calls = 0;
    const first = await firstStore.run("op-key-0001", "talend_jobs_create", { job: "A" }, async () => {
      calls++;
      return { ok: true, job: "A" };
    });
    const replay = await newStore().run("op-key-0001", "talend_jobs_create", { job: "A" }, async () => {
      calls++;
      return { ok: true, job: "A" };
    });

    expect(replay).toEqual(first);
    expect(calls).toBe(1);
  });

  test("rechaza reutilizar la clave con otro payload", async () => {
    const store = newStore();
    await store.run("op-key-0002", "talend_jobs_create", { job: "B" }, async () => ({ ok: true }));
    await expect(store.run("op-key-0002", "talend_jobs_create", { job: "C" }, async () => ({ ok: true })))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  test("incluye el proyecto Talend en la huella de la solicitud", async () => {
    const priorProject = process.env.TALEND_PROJECT;
    try {
      const store = newStore();
      process.env.TALEND_PROJECT = "project-A";
      await store.run("op-key-project", "talend_jobs_create", { job: "same" }, async () => ({ ok: true }));
      process.env.TALEND_PROJECT = "project-B";
      await expect(store.run("op-key-project", "talend_jobs_create", { job: "same" }, async () => ({ ok: true })))
        .rejects.toBeInstanceOf(IdempotencyConflictError);
    } finally {
      if (priorProject === undefined) delete process.env.TALEND_PROJECT;
      else process.env.TALEND_PROJECT = priorProject;
    }
  });

  test("una operación interrumpida queda como incierta y no se reejecuta", async () => {
    const store = newStore();
    let calls = 0;
    await expect(store.run("op-key-0003", "talend_delete_job", { job: "D" }, async () => {
      calls++;
      throw new Error("fallo despues de intentar escribir");
    })).rejects.toThrow("despues de intentar");
    await expect(newStore().run("op-key-0003", "talend_delete_job", { job: "D" }, async () => {
      calls++;
      return { ok: true };
    })).rejects.toBeInstanceOf(IdempotencyOutcomeUnknownError);
    expect(calls).toBe(1);
  });

  test("migra registros JSON previos al SQLite sin volver a ejecutar la operación", async () => {
    const input = { job: "legacy" };
    const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
    const fingerprint = hash(JSON.stringify({ input, operation: "talend_legacy", project: process.env.TALEND_PROJECT ?? null }));
    writeFileSync(join(directory, "idempotency.json"), JSON.stringify([{
      keyHash: hash("legacy-key-0001"),
      fingerprint,
      createdAt: Date.now(),
      state: "complete",
      result: { ok: true, migrated: true },
    }]));

    let calls = 0;
    const result = await newStore().run("legacy-key-0001", "talend_legacy", input, async () => {
      calls++;
      return { ok: true, migrated: false };
    });
    expect(result).toEqual({ ok: true, migrated: true });
    expect(calls).toBe(0);
  });

  test("coalesce reenvíos simultáneos con la misma clave", async () => {
    const store = newStore();
    let calls = 0;
    let release!: (value: { ok: true }) => void;
    const gate = new Promise<{ ok: true }>((resolve) => { release = resolve; });
    const action = async () => { calls++; return await gate; };
    const a = store.run("op-key-0004", "talend_update", { job: "E" }, action);
    const b = store.run("op-key-0004", "talend_update", { job: "E" }, action);
    release({ ok: true });
    expect(await Promise.all([a, b])).toEqual([{ ok: true }, { ok: true }]);
    expect(calls).toBe(1);
  });

  test("coordina dos procesos sobre la misma clave y solo uno ejecuta la escritura", async () => {
    const startFile = join(directory, "child-started.json");
    const workerFile = join(directory, "idempotency-worker.ts");
    const storeModule = pathToFileURL(resolve(import.meta.dir, "../../src/presentation/server/new-server/idempotency-store.ts")).href;
    const source = `
      import { writeFileSync } from "node:fs";
      import { IdempotencyStore } from ${JSON.stringify(storeModule)};
      const store = new IdempotencyStore(${JSON.stringify(directory)});
      const result = await store.run("cross-process-key-01", "talend_update", { job: "J" }, async () => {
        writeFileSync(${JSON.stringify(startFile)}, "started");
        await Bun.sleep(350);
        return { ok: true, owner: "child" };
      });
      console.log(JSON.stringify(result));
      store.close();
    `;
    writeFileSync(workerFile, source, "utf8");
    const child = Bun.spawn([process.execPath, workerFile], { stdout: "pipe", stderr: "pipe" });
    let parentCalls = 0;
    try {
      for (let attempt = 0; attempt < 500 && !existsSync(startFile); attempt++) await Bun.sleep(10);
      expect(existsSync(startFile)).toBe(true);

      const replay = await newStore().run("cross-process-key-01", "talend_update", { job: "J" }, async () => {
        parentCalls++;
        return { ok: true, owner: "parent" };
      });
      const output = await new Response(child.stdout).text();
      expect(await child.exited).toBe(0);
      expect(JSON.parse(output)).toEqual(replay);
      expect(replay).toEqual({ ok: true, owner: "child" });
      expect(parentCalls).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill();
      await child.exited;
    }
  }, 15_000);

  test("un claim pendiente de un proceso muerto pasa a incierto y nunca se repite", async () => {
    const startedFile = join(directory, "crashed-child-started.txt");
    const workerFile = join(directory, "idempotency-crash-worker.ts");
    const storeModule = pathToFileURL(resolve(import.meta.dir, "../../src/presentation/server/new-server/idempotency-store.ts")).href;
    const source = `
      import { writeFileSync } from "node:fs";
      import { IdempotencyStore } from ${JSON.stringify(storeModule)};
      const store = new IdempotencyStore(${JSON.stringify(directory)});
      await store.run("crashed-process-key", "talend_delete_job", { job: "J" }, async () => {
        writeFileSync(${JSON.stringify(startedFile)}, "started");
        await Bun.sleep(30_000);
        return { ok: true };
      });
    `;
    writeFileSync(workerFile, source, "utf8");
    const child = Bun.spawn([process.execPath, workerFile], { stdout: "pipe", stderr: "pipe" });
    try {
      for (let attempt = 0; attempt < 500 && !existsSync(startedFile); attempt++) await Bun.sleep(10);
      expect(existsSync(startedFile)).toBe(true);
      child.kill();
      await child.exited;

      let repeatedCalls = 0;
      await expect(newStore().run("crashed-process-key", "talend_delete_job", { job: "J" }, async () => {
        repeatedCalls++;
        return { ok: true };
      })).rejects.toBeInstanceOf(IdempotencyOutcomeUnknownError);
      expect(repeatedCalls).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill();
      await child.exited;
    }
  }, 15_000);
});
