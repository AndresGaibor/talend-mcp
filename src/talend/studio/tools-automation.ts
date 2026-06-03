import * as z from "zod/v4";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";

export const automationTools = [
  {
    name: "talend_auto_run_active_job",
    description: "Ejecuta el job activo en Studio.",
    inputSchema: z.object({
      dryRun: z.boolean().optional().default(true).describe("Si es dry run"),
      saveBefore: z.boolean().optional().default(true).describe("Guardar antes de ejecutar"),
      waitForTermination: z.boolean().optional().default(true).describe("Esperar a que termine"),
      timeoutMs: z.number().optional().default(120000).describe("Timeout en ms"),
    }),
    handler: async ({ dryRun, saveBefore, waitForTermination, timeoutMs }: { dryRun?: boolean; saveBefore?: boolean; waitForTermination?: boolean; timeoutMs?: number }) => {
      const bridge = await loadBridge();
      const result = await bridge.runActiveJob({
        dryRun: dryRun ?? true,
        saveBefore: saveBefore ?? true,
        waitForTermination: waitForTermination ?? true,
        timeoutMs: timeoutMs ?? 120000,
      });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/run-active-job",
        data: result.data,
      });
    },
  },
  {
    name: "talend_command_catalog",
    description: "Lista el catálogo de comandos disponibles.",
    inputSchema: z.object({}),
    handler: async () => {
      const { getCommandCatalog } = await import("../commands/command-catalog");
      const catalog = getCommandCatalog();
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/commands/catalog",
        data: { commands: catalog.commands, count: catalog.commands.length },
      });
    },
  },
  {
    name: "talend_command_search",
    description: "Busca comandos por nombre o categoría.",
    inputSchema: z.object({
      query: z.string().describe("Texto a buscar"),
    }),
    handler: async ({ query }: { query: string }) => {
      const { searchCommands } = await import("../commands/command-catalog");
      const results = searchCommands(query);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/commands/search",
        data: { results, count: results.length },
      });
    },
  },
  {
    name: "talend_command_allow",
    description: "Permite un comando peligroso.",
    inputSchema: z.object({
      commandId: z.string().describe("ID del comando a permitir"),
    }),
    handler: async ({ commandId }: { commandId: string }) => {
      const { allowCommand } = await import("../commands/command-catalog");
      const ok = allowCommand(commandId);
      return bridgeOk({
        ok,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/commands/allow",
        data: { commandId, allowed: ok },
      });
    },
  },
  {
    name: "talend_command_block",
    description: "Bloquea un comando peligroso.",
    inputSchema: z.object({
      commandId: z.string().describe("ID del comando a bloquear"),
    }),
    handler: async ({ commandId }: { commandId: string }) => {
      const { blockCommand } = await import("../commands/command-catalog");
      const ok = blockCommand(commandId);
      return bridgeOk({
        ok,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/commands/block",
        data: { commandId, blocked: ok },
      });
    },
  },
];