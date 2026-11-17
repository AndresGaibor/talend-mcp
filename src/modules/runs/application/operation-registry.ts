import { randomUUID } from "node:crypto";
import { auditToolCall } from "../../../presentation/server/tool-auth";

export type OperationState = "queued" | "running" | "cancelling" | "succeeded" | "failed" | "cancelled";

export type OperationSnapshot<T = unknown> = {
  operationId: string;
  kind: string;
  state: OperationState;
  startedAt: string;
  finishedAt?: string;
  result?: T;
  errorCode?: string;
  progress?: { completed: number; total: number; currentJob?: string };
};

type Operation<T> = {
  snapshot: OperationSnapshot<T>;
  controller: AbortController;
};

const MAX_OPERATIONS = 200;
const MAX_ACTIVE_OPERATIONS = 4;
const TERMINAL_TTL_MS = 24 * 60 * 60 * 1000;

export class OperationCapacityError extends Error {
  readonly code = "OPERATION_CAPACITY_REACHED";
  constructor() {
    super("No se pueden iniciar más operaciones en segundo plano: el límite de operaciones activas fue alcanzado.");
    this.name = "OperationCapacityError";
  }
}

/** Estado en memoria de operaciones desacopladas; no conserva argumentos. */
export class OperationRegistry {
  private readonly operations = new Map<string, Operation<unknown>>();

  start<T>(kind: string, action: (signal: AbortSignal, operationId: string) => Promise<T>): OperationSnapshot {
    this.prune();
    if (this.operations.size >= MAX_OPERATIONS) {
      auditToolCall("talend_operations", "write", false, "OPERATION_CAPACITY_REACHED");
      throw new OperationCapacityError();
    }
    const active = [...this.operations.values()].filter(({ snapshot }) =>
      snapshot.state === "queued" || snapshot.state === "running" || snapshot.state === "cancelling",
    ).length;
    if (active >= MAX_ACTIVE_OPERATIONS) {
      auditToolCall("talend_operations", "write", false, "OPERATION_CAPACITY_REACHED");
      throw new OperationCapacityError();
    }
    const operationId = randomUUID();
    const controller = new AbortController();
    const operation: Operation<T> = {
      controller,
      snapshot: { operationId, kind, state: "queued", startedAt: new Date().toISOString() },
    };
    this.operations.set(operationId, operation as Operation<unknown>);
    auditToolCall("talend_operations", "write", true, "OPERATION_STARTED", {
      correlationId: operationId,
      operationId,
    });

    queueMicrotask(() => {
      if (controller.signal.aborted) {
        operation.snapshot.state = "cancelled";
        operation.snapshot.finishedAt = new Date().toISOString();
        auditToolCall("talend_operations", "write", true, "OPERATION_CANCELLED", {
          correlationId: operationId,
          operationId,
        });
        return;
      }
      operation.snapshot.state = "running";
      void Promise.resolve().then(() => action(controller.signal, operationId)).then((result) => {
        operation.snapshot.result = result;
        const outcome = result && typeof result === "object" ? result as { ok?: unknown; cancelled?: unknown } : undefined;
        operation.snapshot.state = outcome?.cancelled === true
          ? "cancelled"
          : outcome?.ok === false ? "failed" : "succeeded";
        if (operation.snapshot.state === "failed") operation.snapshot.errorCode = "RUN_FAILED";
      }).catch((error: unknown) => {
        operation.snapshot.state = controller.signal.aborted ? "cancelled" : "failed";
        operation.snapshot.errorCode = controller.signal.aborted ? "CANCELLED" : "OPERATION_FAILED";
        void error;
      }).finally(() => {
        operation.snapshot.finishedAt = new Date().toISOString();
        if (operation.snapshot.state === "cancelled") {
          auditToolCall("talend_operations", "write", true, "OPERATION_CANCELLED", {
            correlationId: operationId,
            operationId,
          });
        }
      });
    });

    return { ...operation.snapshot };
  }

  status(operationId: string): OperationSnapshot | undefined {
    this.prune();
    const operation = this.operations.get(operationId);
    return operation ? { ...operation.snapshot } : undefined;
  }

  cancel(operationId: string): OperationSnapshot | undefined {
    const operation = this.operations.get(operationId);
    if (!operation) return undefined;
    const state = operation.snapshot.state;
    if (state === "queued" || state === "running") {
      operation.snapshot.state = "cancelling";
      operation.controller.abort();
      auditToolCall("talend_operations", "write", true, "OPERATION_CANCEL_REQUESTED", {
        correlationId: operationId,
        operationId,
      });
    }
    return { ...operation.snapshot };
  }

  updateProgress(operationId: string, progress: { completed: number; total: number; currentJob?: string }): void {
    const operation = this.operations.get(operationId);
    if (!operation || !["queued", "running", "cancelling"].includes(operation.snapshot.state)) return;
    operation.snapshot.progress = { ...progress };
  }

  private prune(): void {
    const cutoff = Date.now() - TERMINAL_TTL_MS;
    for (const [id, operation] of this.operations) {
      const snapshot = operation.snapshot;
      if (snapshot.finishedAt && Date.parse(snapshot.finishedAt) < cutoff) this.operations.delete(id);
    }
    while (this.operations.size >= MAX_OPERATIONS) {
      const oldestTerminal = [...this.operations].find(([, operation]) => !!operation.snapshot.finishedAt);
      if (!oldestTerminal) break;
      this.operations.delete(oldestTerminal[0]);
    }
  }
}

export const operationRegistry = new OperationRegistry();
