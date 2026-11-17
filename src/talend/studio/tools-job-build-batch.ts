import * as z from "zod/v4";
import { avisoDeFaltantes, completarJobsFaltantes } from "./build-batch-resultado";
import type { CuerpoDeLote } from "./build-batch-resultado";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import { operationRegistry } from "../../modules/runs/application/operation-registry";
import { resourceLocks } from "../../presentation/server/new-server/resource-lock";

const ENDPOINT = "/automation/job/build-batch";

/**
 * Construccion masiva para migraciones: genera y compila muchos jobs del repositorio sin abrir su editor
 * (unos 0,2 s por job con 4 hilos). No ejecuta nada: para comprobar la ejecucion de un job hay que usar
 * `talend_job_verify`.
 */
export const jobBuildBatchTools = [
  {
    name: "talend_job_build_batch",
    description: "Genera el codigo y compila muchos Jobs del repositorio sin abrir editores. Devuelve el resultado de cada Job; no los ejecuta. Para lotes largos usa talend_job_build_batch_start y consulta talend_operations_status. Los Jobs escritos por fichero deben existir en el repositorio de Studio.",
    inputSchema: z.object({
      jobs: z.array(z.string().min(1)).min(1).max(5000).describe("Nombres de los jobs a construir (maximo 5000 por llamada)"),
      parallelism: z.number().int().min(1).max(16).optional().default(4).describe("Hilos de compilacion (por defecto 4; mas de 4 no suele mejorar)"),
    }),
    handler: async ({ jobs, parallelism }: { jobs: string[]; parallelism?: number }) => {
      const bridge = await loadBridge();
      const result = await bridge.jobBuildBatch({ jobs, parallelism: parallelism ?? 4 });
      if (!result.ok) {
        return bridgeFail({
          ok: false,
          source: result.source,
          confidence: result.confidence,
          endpoint: ENDPOINT,
          error: result.error ?? { code: "BUILD_BATCH_FAILED", message: "El bridge no pudo construir el lote." },
        });
      }
      // Un `ok` con el mapa `jobs` incompleto (o vacio) no es un lote correcto: los Jobs que
      // faltan quedan como no compilados, con su motivo, para que el llamador no los cuente.
      const { cuerpo, faltantes } = completarJobsFaltantes(
        jobs,
        (result.data ?? {}) as CuerpoDeLote,
      );
      return bridgeOk({
        ok: true,
        source: result.source,
        confidence: result.confidence,
        endpoint: ENDPOINT,
        data: cuerpo,
        warning: avisoDeFaltantes(faltantes),
      });
    },
  },
  {
    name: "talend_job_build_batch_start",
    description: "Inicia la generación/compilación de varios Jobs en segundo plano y devuelve operationId. Consulta talend_operations_status; talend_operations_cancel detiene el lote entre Jobs y deja terminar las compilaciones ya activas. El estado remoto se puede recuperar tras reiniciar MCP mientras el bridge siga activo.",
    inputSchema: z.object({
      jobs: z.array(z.string().min(1)).min(1).max(5000).describe("Nombres de los Jobs que se van a construir"),
      parallelism: z.number().int().min(1).max(16).optional().default(4),
    }),
    handler: async ({ jobs, parallelism }: { jobs: string[]; parallelism?: number }) => {
      const operation = operationRegistry.start("job-build-batch", async (signal, operationId) => await resourceLocks.run(
        jobs.map((job) => `job:${job}`),
        signal,
        async () => {
          const bridge = await loadBridge();
          const started = await bridge.jobBuildBatchStart({
            jobs,
            parallelism: parallelism ?? 4,
            operationId,
          });
          const startData = asRecord(started.data?.result);
          const remoteOperationId = typeof startData?.operationId === "string" ? startData.operationId : undefined;
          if (!started.ok || !remoteOperationId || remoteOperationId !== operationId) {
            throw new Error("El bridge no devolvió un operationId para iniciar el build batch.");
          }

          let remoteCancelRequested = false;
          const requestRemoteCancel = (): void => {
            if (remoteCancelRequested) return;
            remoteCancelRequested = true;
            void bridge.jobBuildBatchCancel(remoteOperationId).catch(() => undefined);
          };
          signal.addEventListener("abort", requestRemoteCancel, { once: true });
          try {
            while (true) {
              if (signal.aborted) requestRemoteCancel();
              const status = await bridge.jobBuildBatchStatus(remoteOperationId);
              const snapshot = asRecord(status.data?.result);
              if (!status.ok || !snapshot || snapshot.found === false) throw new Error("No se pudo consultar el estado del build batch remoto.");
              if (typeof snapshot.completed === "number" && typeof snapshot.total === "number") {
                operationRegistry.updateProgress(operationId, {
                  completed: snapshot.completed,
                  total: snapshot.total,
                  ...(typeof snapshot.currentJob === "string" && snapshot.currentJob ? { currentJob: snapshot.currentJob } : {}),
                });
              }
              const state = snapshot.state;
              if (state === "succeeded" || state === "failed" || state === "cancelled") {
                const result = snapshot.result;
                return {
                  ok: state === "succeeded",
                  ...(state === "cancelled" ? { cancelled: true } : {}),
                  operationId: remoteOperationId,
                  state,
                  result,
                };
              }
              await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            }
          } finally {
            signal.removeEventListener("abort", requestRemoteCancel);
          }
        },
      ));
      return bridgeOk({ ok: true, source: "studio-bridge", confidence: "high", endpoint: "/automation/job/build-batch/start", data: operation });
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
