import * as z from "zod/v4";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";

const ENDPOINT = "/automation/job/build-batch";

/**
 * Construccion masiva para migraciones: genera y compila muchos jobs del repositorio sin abrir su editor
 * (unos 0,2 s por job con 4 hilos). No ejecuta nada: para comprobar la ejecucion de un job hay que usar
 * `talend_job_verify`.
 */
export const jobBuildBatchTools = [
  {
    name: "talend_job_build_batch",
    description: "Genera el codigo y compila MUCHOS jobs del repositorio sin abrir su editor, en paralelo (unos 0,2 s por job). Pensada para migraciones masivas: devuelve por cada job si compila y el error de javac si no. No ejecuta los jobs; para uno concreto usa talend_job_verify. Los jobs deben existir ya en el repositorio de Studio (si los has escrito por fichero, refresca el workspace antes).",
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
      return bridgeOk({ ok: true, source: result.source, confidence: result.confidence, endpoint: ENDPOINT, data: result.data });
    },
  },
];
