import type { McpToolDefinition } from "../adapt-tool";
import { buildRuntimeToolCache, getCachedTool } from "./runtime-cache";

/** Definicion MCP de una tool registrada, buscada por su nombre exacto. */
export function getToolByName(name: string): McpToolDefinition | undefined {
  buildRuntimeToolCache();
  return getCachedTool(name)?.definition;
}
