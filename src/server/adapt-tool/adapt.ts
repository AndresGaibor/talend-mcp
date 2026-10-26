import type { McpToolDefinition } from "./types";
import { isLegacyToolDef, isTalendToolDef } from "./schema-guards";
import { extractAnnotations } from "./annotations";
import { convertInputSchema } from "./input-schema";
import { resolveOutputSchema } from "./output-schema";

export function adaptToolToMcp(tool: unknown): McpToolDefinition {
  if (isTalendToolDef(tool)) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: convertInputSchema(tool.inputSchema),
      outputSchema: resolveOutputSchema(tool.name, tool.outputSchema),
      annotations: extractAnnotations(tool),
      _meta: (tool as any)._meta,
    };
  }

  if (isLegacyToolDef(tool)) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: convertInputSchema(tool.inputSchema),
      outputSchema: resolveOutputSchema(tool.name, tool.outputSchema),
      annotations: extractAnnotations(tool),
      _meta: (tool as any)._meta,
    };
  }

  if (typeof tool === "object" && tool !== null) {
    const t = tool as any;
    if ("inputSchema" in t && "handler" in t) {
      return {
        name: t.name,
        description: t.description,
        inputSchema: convertInputSchema(t.inputSchema),
        outputSchema: resolveOutputSchema(t.name, t.outputSchema),
        annotations: extractAnnotations(t),
        _meta: t._meta,
      };
    }
  }

  throw new Error(`Tipo de herramienta desconocido: ${JSON.stringify(tool)}`);
}
