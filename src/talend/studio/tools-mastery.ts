import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";
import { existsSync } from "node:fs";

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
];