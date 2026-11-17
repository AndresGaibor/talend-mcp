import { describe, expect, test } from "bun:test";
import type { TalendStudioBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { recoverRemoteBuildOperation } from "../../src/modules/runs/application/remote-build-recovery";

function bridgeWith(snapshot: Record<string, unknown>) {
  return {
    jobBuildBatchStatus: async () => ({
      ok: true,
      source: "studio-bridge",
      confidence: "high",
      data: { result: snapshot },
    }),
  } as unknown as Pick<TalendStudioBridgeClient, "jobBuildBatchStatus">;
}

describe("recuperacion de builds remotos", () => {
  test("reconstruye estado, progreso y resultado terminal despues de perder el registro local", async () => {
    const operationId = "de305d54-75b4-431b-adb2-eb6b9e546014";
    const snapshot = await recoverRemoteBuildOperation(operationId, bridgeWith({
      found: true,
      operationId,
      state: "failed",
      total: 3,
      completed: 2,
      currentJob: "JOB_2",
      createdAt: 1_794_412_000_000,
      finishedAt: 1_794_412_002_000,
      errorCode: "BUILD_BATCH_FAILED",
      result: { total: 3, correctos: 1, completed: 2 },
    }));

    expect(snapshot).toMatchObject({
      operationId,
      kind: "job-build-batch",
      state: "failed",
      errorCode: "BUILD_BATCH_FAILED",
      progress: { total: 3, completed: 2, currentJob: "JOB_2" },
      result: {
        ok: false,
        operationId,
        state: "failed",
        result: { total: 3, correctos: 1, completed: 2 },
      },
    });
    expect(Date.parse(snapshot!.startedAt)).toBe(1_794_412_000_000);
  });

  test("devuelve undefined si el bridge ya no conserva la operacion", async () => {
    const operationId = "de305d54-75b4-431b-adb2-eb6b9e546014";
    await expect(recoverRemoteBuildOperation(operationId, bridgeWith({ found: false }))).resolves.toBeUndefined();
  });

  test("rechaza estados remotos desconocidos para no presentar una recuperacion falsa", async () => {
    const operationId = "de305d54-75b4-431b-adb2-eb6b9e546014";
    await expect(recoverRemoteBuildOperation(operationId, bridgeWith({ found: true, state: "mystery" })))
      .rejects.toThrow("estado de operacion desconocido");
  });
});
