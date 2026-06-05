import type { McpServer } from "@modelcontextprotocol/server";
import type { TalendToolDefinition, ToolSafety, ToolContext } from "./tool-definition";
import type { TalendResult } from "../shared/result/talend-result";

export const DEPRECATION_REMOVAL_DATE = "2026-08-01";

export interface ToolContainer {
  get<T>(token: string): T;
}

function buildDeprecationWarning(legacyName: string, canonicalName: string): string {
  return `La tool ${legacyName} es legacy. Usa ${canonicalName}. Será removida después de ${DEPRECATION_REMOVAL_DATE}.`;
}

export function wrapHandlerWithDeprecationWarning<I, O>(
  tool: TalendToolDefinition<I, O>,
  canonicalName: string
): TalendToolDefinition<I, O> {
  const warning = buildDeprecationWarning(tool.name, canonicalName);
  const originalHandler = tool.handler;

  const wrappedHandler = async (input: I, ctx: ToolContext): Promise<TalendResult<O>> => {
    const result = await originalHandler(input, ctx);
    if (result.warnings) {
      result.warnings.push(warning);
    } else {
      result.warnings = [warning];
    }
    return result;
  };

  return {
    ...tool,
    handler: wrappedHandler,
  };
}

const canonicalTools: TalendToolDefinition<unknown, unknown>[] = [];
const legacyAliases: Map<string, string> = new Map();
const toolSafetyMap: Map<string, ToolSafety> = new Map();

export function registerTools(
  _server: McpServer,
  _container: ToolContainer
): void {
  // Tools will be registered via this function
  // This allows DI container integration with MCP server
}

export function getAllCanonicalTools(): TalendToolDefinition<unknown, unknown>[] {
  return [...canonicalTools];
}

export function getToolByName(
  name: string
): TalendToolDefinition<unknown, unknown> | undefined {
  return canonicalTools.find((tool) => tool.name === name);
}

export function getToolSafety(
  name: string
): ToolSafety | undefined {
  return toolSafetyMap.get(name);
}

export function getLegacyAliases(): Map<string, string> {
  return new Map(legacyAliases);
}

export function registerCanonicalTool<I, O>(
  tool: TalendToolDefinition<I, O>
): void {
  canonicalTools.push(tool as TalendToolDefinition<unknown, unknown>);
  toolSafetyMap.set(tool.name, tool.safety);
}

export function registerLegacyAlias(
  legacyName: string,
  canonicalName: string
): void {
  legacyAliases.set(legacyName, canonicalName);
}
