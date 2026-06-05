import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";
import { existsSync } from "node:fs";
import { LearnComponentBatchUseCase, learnSingleComponent } from "../../modules/component-knowledge/application/learn-component-batch.use-case";
import { ComponentMasteryCacheRepository } from "../../modules/component-knowledge/infrastructure/component-mastery-cache.repository";

const batchUseCase = new LearnComponentBatchUseCase();
const masteryCacheRepo = new ComponentMasteryCacheRepository();

export const masteryTools = [
  {
    name: "talend_mastery_component",
    description: "Ejecuta mastery para un componente específico.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryComponent } = await import("../mastery/component-mastery-runner");
      const result = await masteryComponent(componentName);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/component",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_all_components",
    description: "Ejecuta mastery para todos los componentes del catálogo.",
    inputSchema: z.object({}),
    handler: async () => {
      const { masteryAllComponents } = await import("../mastery/component-mastery-runner");
      const result = await masteryAllComponents();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/all-components",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_report",
    description: "Genera un reporte de mastery.",
    inputSchema: z.object({}),
    handler: async () => {
      const { generateMasteryReport } = await import("../mastery/component-mastery-runner");
      const result = await generateMasteryReport();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/report",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_generate_fixture",
    description: "Genera un fixture para probar un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryGenerateFixture } = await import("../mastery/component-mastery-runner");
      const result = await masteryGenerateFixture(componentName);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/mastery/generate-fixture",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_validate_roundtrip",
    description: "Valida round-trip para un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
      itemPath: z.string().describe("Ruta al archivo .item"),
    }),
    handler: async ({ componentName, itemPath }: { componentName: string; itemPath: string }) => {
      if (!existsSync(itemPath)) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/mastery/validate-roundtrip",
          error: { code: "FILE_NOT_FOUND", message: "Archivo no encontrado: " + itemPath },
        });
      }
      const { validateRoundTrip } = await import("../mastery/component-mastery-runner");
      const result = await validateRoundTrip(componentName, itemPath);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/mastery/validate-roundtrip",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_validate_in_studio",
    description: "Valida que un componente abre en Studio.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { markOpensInStudio } = await import("../mastery/component-mastery-runner");
      const { loadBridge } = await import("./tools-base");
      const bridge = await loadBridge();
      if (!bridge) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/mastery/validate-in-studio",
          error: { code: "BRIDGE_UNAVAILABLE", message: "Bridge no disponible" },
        });
      }
      const result = await markOpensInStudio(componentName, {
        source: "studio-bridge",
        confidence: "high",
        details: { validatedVia: "activeJobModel" },
      });
      return bridgeOk({
        ok: true,
        source: "studio-bridge",
        confidence: "high",
        endpoint: "/mastery/validate-in-studio",
        data: result,
      });
    },
  },
  {
    name: "talend_mastery_validate_run",
    description: "Valida que un componente ejecuta correctamente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
      itemPath: z.string().describe("Ruta al archivo .item"),
      jobName: z.string().optional().describe("Nombre del job"),
    }),
    handler: async ({ componentName, itemPath, jobName }: { componentName: string; itemPath: string; jobName?: string }) => {
      const { validateComponentRun } = await import("../mastery/component-run-validator");
      const bridge = await loadBridge();
      const result = await validateComponentRun(componentName, itemPath, bridge, {
        unsafeActions: false,
        jobName,
      });
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "studio-bridge" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/mastery/validate-run",
        data: result,
      });
    },
  },
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