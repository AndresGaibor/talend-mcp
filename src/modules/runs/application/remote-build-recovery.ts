import type { TalendStudioBridgeClient } from "../../studio-bridge/adapters/http-studio-bridge.client";
import type { OperationSnapshot, OperationState } from "./operation-registry";

type RemoteSnapshot = Record<string, unknown>;

/** Reconstruye desde el bridge el estado de un build cuyo registro MCP se perdió al reiniciar. */
export async function recoverRemoteBuildOperation(
  operationId: string,
  bridge: Pick<TalendStudioBridgeClient, "jobBuildBatchStatus">,
): Promise<OperationSnapshot | undefined> {
  const response = await bridge.jobBuildBatchStatus(operationId);
  if (!response.ok) throw new Error("No se pudo consultar el estado remoto de la operacion.");
  const snapshot = asRecord(response.data?.result);
  if (!snapshot || snapshot.found === false) return undefined;

  const state = parseState(snapshot.state);
  if (!state) throw new Error("El bridge devolvio un estado de operacion desconocido.");
  const total = finiteNumber(snapshot.total);
  const completed = finiteNumber(snapshot.completed);
  const createdAt = finiteNumber(snapshot.createdAt);
  const finishedAt = finiteNumber(snapshot.finishedAt);
  const remoteResult = snapshot.result;

  return {
    operationId,
    kind: "job-build-batch",
    state,
    startedAt: createdAt === undefined ? new Date().toISOString() : new Date(createdAt).toISOString(),
    ...(finishedAt === undefined ? {} : { finishedAt: new Date(finishedAt).toISOString() }),
    ...(typeof snapshot.errorCode === "string" ? { errorCode: snapshot.errorCode } : {}),
    ...(total === undefined || completed === undefined ? {} : {
      progress: {
        total,
        completed,
        ...(typeof snapshot.currentJob === "string" && snapshot.currentJob ? { currentJob: snapshot.currentJob } : {}),
      },
    }),
    ...(remoteResult === undefined ? {} : {
      result: {
        ok: state === "succeeded",
        ...(state === "cancelled" ? { cancelled: true } : {}),
        operationId,
        state,
        result: remoteResult,
      },
    }),
  };
}

function parseState(value: unknown): OperationState | undefined {
  return value === "queued" || value === "running" || value === "cancelling"
    || value === "succeeded" || value === "failed" || value === "cancelled"
    ? value
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): RemoteSnapshot | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RemoteSnapshot : undefined;
}
