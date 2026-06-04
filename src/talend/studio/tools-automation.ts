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
    name: "talend_commands_catalog",
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
    name: "talend_commands_search",
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
    name: "talend_commands_allow",
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
    name: "talend_commands_block",
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
  {
    name: "talend_commands_scan",
    description: "Sincroniza el catálogo de comandos con los comandos disponibles en el bridge.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const { commands: bridgeCommands } = (await bridge.commandsList()).data ?? {};
      if (!bridgeCommands) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "low",
          endpoint: "/commands/scan",
          error: { code: "BRIDGE_ERROR", message: "No se pudieron obtener comandos del bridge" },
        });
      }
      const { classifyCommand, getCommandCatalog } = await import("../commands/command-catalog");
      for (const cmd of bridgeCommands) {
        classifyCommand(cmd.id, cmd.name ?? "", cmd.category ?? "General");
      }
      const catalog = getCommandCatalog();
      return bridgeOk({
        ok: true,
        source: "mcp+studio-bridge",
        confidence: "high",
        endpoint: "/commands/scan",
        data: { count: catalog.commands.length, catalog },
      });
    },
  },
  {
    name: "talend_commands_execute_safe",
    description: "Ejecuta un comando solo si está permitido y es seguro. Los comandos danger requieren allowDanger=true.",
    inputSchema: z.object({
      commandId: z.string().describe("ID del comando"),
      dryRun: z.boolean().optional().default(false).describe("Si es dry run"),
      allowDanger: z.boolean().optional().default(false).describe("Permitir ejecutar comandos peligrosos"),
    }),
    handler: async ({ commandId, dryRun, allowDanger }: { commandId: string; dryRun?: boolean; allowDanger?: boolean }) => {
      const { isCommandAllowed, getCommand } = await import("../commands/command-catalog");
      const cmd = getCommand(commandId);
      if (!cmd) {
        return bridgeFail({
          ok: false,
          source: "mcp",
          confidence: "low",
          endpoint: "/commands/execute-safe",
          error: { code: "NOT_FOUND", message: "Comando no encontrado en catálogo: " + commandId },
        });
      }
      if (cmd.risk === "danger" && !allowDanger) {
        return bridgeFail({
          ok: false,
          source: "mcp",
          confidence: "high",
          endpoint: "/commands/execute-safe",
          error: { code: "DANGER_COMMAND_BLOCKED", message: "El comando es peligroso. Usa allowDanger=true explícitamente si realmente quieres ejecutarlo." },
        });
      }
      if (!isCommandAllowed(commandId)) {
        return bridgeFail({
          ok: false,
          source: "mcp",
          confidence: "high",
          endpoint: "/commands/execute-safe",
          error: { code: "BLOCKED", message: "Comando bloqueado por política de seguridad: " + commandId },
        });
      }
      const bridge = await loadBridge();
      const result = await bridge.executeCommand(commandId, dryRun ?? false);
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/commands/execute-safe",
        data: result.data,
      });
    },
  },
];