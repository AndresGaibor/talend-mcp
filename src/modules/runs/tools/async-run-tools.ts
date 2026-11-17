import { z } from "zod/v4";
import { errorResult, okResult } from "../../../presentation/tools/common/result";
import { runJob } from "../../../talend/executor";
import { operationRegistry } from "../application/operation-registry";
import { recoverRemoteBuildOperation } from "../application/remote-build-recovery";
import { resourceLocks } from "../../../presentation/server/new-server/resource-lock";
import { loadBridge } from "../../../talend/studio/tools-base";

const StartSchema = z.object({
  job: z.string().min(1),
  context: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  params: z.record(z.string(), z.string()).optional(),
  confirm: z.literal(true),
});

export function createAsyncRunStartTool() {
  return {
    name: "talend_runs_start_async",
    description: "Inicia una ejecución en segundo plano y devuelve un operationId para consultar estado o cancelarla. Requiere confirm:true.",
    inputSchema: StartSchema,
    annotations: { readOnlyHint: false, openWorldHint: true, requiresConfirmation: true },
    handler: async (input: z.infer<typeof StartSchema>) => {
      const operation = operationRegistry.start("job-run", async (signal) => await resourceLocks.run(
        [`job:${input.job}`],
        signal,
        async () => await runJob({
          jobName: input.job,
          contextName: input.context,
          timeoutMs: input.timeoutMs,
          params: input.params,
          signal,
        }),
      ));
      return okResult(operation, "run-start-async");
    },
  };
}

const OperationSchema = z.object({ operationId: z.string().uuid() });

export function createAsyncRunStatusTool() {
  return {
    name: "talend_operations_status",
    description: "Consulta el estado de una operación asíncrona por operationId, incluido su resultado terminal.",
    inputSchema: OperationSchema,
    annotations: { readOnlyHint: true },
    handler: async (input: z.infer<typeof OperationSchema>) => {
      const operation = operationRegistry.status(input.operationId);
      if (operation) return okResult(operation, "operation-status");
      try {
        const recovered = await recoverRemoteBuildOperation(input.operationId, await loadBridge());
        return recovered
          ? okResult(recovered, "operation-status")
          : errorResult("operation-status", "OPERATION_NOT_FOUND", `Operación no encontrada: ${input.operationId}`);
      } catch {
        return errorResult("operation-status", "OPERATION_RECOVERY_UNAVAILABLE", "No se pudo recuperar el estado remoto; no reinicies el build hasta confirmar el estado en Studio.");
      }
    },
  };
}

export function createAsyncRunCancelTool() {
  return {
    name: "talend_operations_cancel",
    description: "Solicita la cancelación de una operación asíncrona cuando el backend lo permite; consulta el estado para confirmar el resultado.",
    inputSchema: OperationSchema,
    annotations: { readOnlyHint: false },
    handler: async (input: z.infer<typeof OperationSchema>) => {
      const operation = operationRegistry.cancel(input.operationId);
      if (operation) return okResult(operation, "operation-cancel");
      try {
        const bridge = await loadBridge();
        const cancelled = await bridge.jobBuildBatchCancel(input.operationId);
        const snapshot = asRecord(cancelled.data?.result);
        if (!cancelled.ok) {
          return errorResult("operation-cancel", "OPERATION_RECOVERY_UNAVAILABLE", "No se pudo solicitar la cancelación remota; consulta el estado antes de reintentar.");
        }
        if (!snapshot || snapshot.found === false) {
          return errorResult("operation-cancel", "OPERATION_NOT_FOUND", `Operación no encontrada: ${input.operationId}`);
        }
        const recovered = await recoverRemoteBuildOperation(input.operationId, bridge);
        return recovered
          ? okResult(recovered, "operation-cancel")
          : errorResult("operation-cancel", "OPERATION_NOT_FOUND", `Operación no encontrada: ${input.operationId}`);
      } catch {
        return errorResult("operation-cancel", "OPERATION_RECOVERY_UNAVAILABLE", "No se pudo solicitar la cancelación remota; consulta el estado antes de reintentar.");
      }
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
