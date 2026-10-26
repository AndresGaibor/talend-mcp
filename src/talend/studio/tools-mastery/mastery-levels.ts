/**
 * Marcado de niveles de mastery: sesiones por lotes y aprendizaje de un componente.
 */
import * as z from "zod/v4";
import { bridgeFail, bridgeOk } from "../tools-base";
import { LearnComponentBatchUseCase, learnSingleComponent } from "../../../modules/component-knowledge/application/learn-component-batch.use-case";
import { ComponentMasteryCacheRepository } from "../../../modules/component-knowledge/infrastructure/component-mastery-cache.repository";

const batchUseCase = new LearnComponentBatchUseCase();
const masteryCacheRepo = new ComponentMasteryCacheRepository();

export const masteryLevelTools = [
  {
    name: "talend_mastery_batch_start",
    description: "Inicia una sesión de aprendizaje por lotes de componentes.",
    inputSchema: z.object({
      sessionId: z.string().describe("ID único de la sesión de batch"),
    }),
    handler: async ({ sessionId }: { sessionId: string }) => {
      try {
        const result = await batchUseCase.start(sessionId);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/mastery/batch/start",
          data: {
            sessionId,
            batchToken: result.batchToken,
            components: result.components,
            total: result.total,
            batchSize: 25,
          },
        });
      } catch (e) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/mastery/batch/start",
          error: { code: "BATCH_START_FAILED", message: e instanceof Error ? e.message : String(e) },
        });
      }
    },
  },
  {
    name: "talend_mastery_batch_continue",
    description: "Continúa una sesión de aprendizaje por lotes.",
    inputSchema: z.object({
      sessionId: z.string().describe("ID de la sesión de batch"),
      batchToken: z.string().describe("Token del batch activo"),
      fromIndex: z.number().describe("Índice desde donde continuar"),
    }),
    handler: async ({ sessionId, batchToken, fromIndex }: { sessionId: string; batchToken: string; fromIndex: number }) => {
      try {
        const result = await batchUseCase.continue(sessionId, batchToken, fromIndex);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/mastery/batch/continue",
          data: {
            sessionId,
            components: result.components,
            hasMore: result.hasMore,
            progress: result.progress,
          },
        });
      } catch (e) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/mastery/batch/continue",
          error: { code: "BATCH_CONTINUE_FAILED", message: e instanceof Error ? e.message : String(e) },
        });
      }
    },
  },
  {
    name: "talend_mastery_batch_status",
    description: "Obtiene el estado de una sesión de aprendizaje por lotes.",
    inputSchema: z.object({
      sessionId: z.string().describe("ID de la sesión de batch"),
    }),
    handler: async ({ sessionId }: { sessionId: string }) => {
      try {
        const progress = await batchUseCase.getSessionProgress(sessionId);
        const isComplete = await batchUseCase.isSessionComplete(sessionId);
        const cacheStatus = await masteryCacheRepo.getStatus();

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/mastery/batch/status",
          data: {
            sessionId,
            progress,
            isComplete,
            cacheStatus,
          },
        });
      } catch (e) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/mastery/batch/status",
          error: { code: "BATCH_STATUS_FAILED", message: e instanceof Error ? e.message : String(e) },
        });
      }
    },
  },
  {
    name: "talend_mastery_learn_component",
    description: "Aprende un componente específico y guarda su mastery.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      try {
        const result = await learnSingleComponent(componentName);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/mastery/learn-component",
          data: result,
        });
      } catch (e) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/mastery/learn-component",
          error: { code: "LEARN_COMPONENT_FAILED", message: e instanceof Error ? e.message : String(e) },
        });
      }
    },
  },
];
