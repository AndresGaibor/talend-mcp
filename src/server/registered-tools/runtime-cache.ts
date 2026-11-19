import { getRegisteredServerTools, GENERIC_TOOL_OUTPUT_SCHEMA, getRegisteredServerToolAnnotations } from "../../presentation/server/tool-registry";
import type { McpToolDefinition } from "../adapt-tool";
import { adaptToolToMcp } from "../adapt-tool";
import { getToolRisk } from "../../presentation/server/tool-safety";
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
  const modules = getModuleTools(() => getAllRuntimeTools());
  for (const tool of modules) {
    if (!tool.definition.outputSchema) {
      (tool.definition as any).outputSchema = GENERIC_TOOL_OUTPUT_SCHEMA;
    }
    if (cache.has(tool.definition.name)) {
      throw new Error(`Tool duplicada detectada: "${tool.definition.name}". Una herramienta de modulo sobrescribe una legacy: declara el alias explicito o renombra.`);
    }
    cache.set(tool.definition.name, tool);
  }

  // La tabla de riesgo manda sobre la heuristica por verbos: una tool de lectura publicada como
  // readOnly=false hace que Copilot y Claude Desktop pidan confirmacion en cada llamada.
  for (const { definition } of cache.values()) {
    if (getToolRisk(definition.name) !== "read") continue;
    definition.annotations = {
      ...definition.annotations,
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    };
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
