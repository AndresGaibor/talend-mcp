import { getRegisteredServerTools, GENERIC_TOOL_OUTPUT_SCHEMA, getRegisteredServerToolAnnotations } from "../../presentation/server/tool-registry";
import type { McpToolDefinition } from "../adapt-tool";
import { adaptToolToMcp } from "../adapt-tool";
import { getModuleTools } from "./module-tools";
import { applyFilter } from "./presets";
import type { RuntimeTool } from "./types";

let toolCache: Map<string, RuntimeTool> | null = null;

export function buildRuntimeToolCache(): void {
  if (toolCache !== null) return;

  const cache = new Map<string, RuntimeTool>();

  // 1. Herramientas legacy (incluyendo alias configurados en tool-registry)
  const legacyTools = getRegisteredServerTools();
  for (const tool of legacyTools) {
    const definition = adaptToolToMcp(tool);
    const registryAnn = getRegisteredServerToolAnnotations(tool.name);
    if (registryAnn) {
      definition.annotations = {
        readOnlyHint: registryAnn.readOnlyHint,
        idempotentHint: registryAnn.idempotentHint,
        destructiveHint: registryAnn.destructiveHint,
        openWorldHint: registryAnn.openWorldHint,
        requiresConfirmation: registryAnn.requiresConfirmation ?? registryAnn.destructiveHint,
        ...definition.annotations,
      };
    }
    cache.set(definition.name, {
      definition,
      handler: tool.handler,
    });
  }

  // 2. Herramientas de modulo (Canónicas)
  // Estas tienen prioridad y sobrescriben a las legacy si hay colision de nombres
  const modules = getModuleTools(() => getAllRuntimeTools());
  for (const tool of modules) {
    if (!tool.definition.outputSchema) {
      (tool.definition as any).outputSchema = GENERIC_TOOL_OUTPUT_SCHEMA;
    }
    cache.set(tool.definition.name, tool);
  }

  toolCache = cache;
}

/** Acceso de solo lectura a la cache, previa construccion. */
export function getCachedTool(name: string): RuntimeTool | undefined {
  return toolCache?.get(name);
}

export function getAllRuntimeTools(): McpToolDefinition[] {
  buildRuntimeToolCache();
  const tools = Array.from(toolCache!.values()).map((t) => t.definition);
  return applyFilter(tools, process.env.TALEND_MCP_FILTER);
}

export function getRuntimeTools(): RuntimeTool[] {
  buildRuntimeToolCache();
  const tools = Array.from(toolCache!.values());
  return applyFilter(tools, process.env.TALEND_MCP_FILTER);
}
