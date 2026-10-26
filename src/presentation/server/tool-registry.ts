import { allTools as presentationTools } from "../tools/registry";
import { createStudioBridgeTools } from "../../talend/studio/bridge-tools";
import { secretTools } from "../../talend/studio/tools-secrets";
import { fromJsonSchema } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { getToolAnnotations } from "./tool-safety";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  handler: (input: any) => Promise<unknown>;
};

export const GENERIC_TOOL_OUTPUT_SCHEMA = z.object({
  ok: z.boolean().optional(),
  source: z.string().optional(),
  confidence: z.union([
    z.literal("high"),
    z.literal("medium"),
    z.literal("low"),
    z.literal("none"),
  ]).optional(),
  endpoint: z.string().optional(),
  data: z.unknown().optional(),
  warning: z.string().optional(),
  limitations: z.array(z.string()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
}).passthrough();

function dedupeTools(tools: ToolDef[]): ToolDef[] {
  const seen = new Set<string>();
  const result: ToolDef[] = [];

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Tool duplicada detectada: "${tool.name}". Revisa que no haya definiciones duplicadas en presentationTools, bridgeTools, studioToolDefs o secretTools.`);
    }
    seen.add(tool.name);
    result.push(tool);
  }

  return result;
}

const registeredTools = dedupeTools([
  ...presentationTools,
  ...createStudioBridgeTools(),
  ...secretTools,
]);

function isPlainJsonSchema(schema: unknown): schema is Record<string, unknown> {
  return typeof schema === "object" && schema !== null && !("~standard" in schema);
}

function normalizeInputSchema(schema: unknown): unknown {
  if (isPlainJsonSchema(schema)) {
    return fromJsonSchema(schema as Record<string, unknown>);
  }
  return schema;
}

function withDefaultOutputSchema(tool: ToolDef): ToolDef {
  return {
    ...tool,
    inputSchema: normalizeInputSchema(tool.inputSchema),
    outputSchema: tool.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA,
  };
}

export function getRegisteredServerTools(): ToolDef[] {
  return registeredTools.map(withDefaultOutputSchema);
}

export function getRegisteredServerToolCount(): number {
  return registeredTools.length;
}

export function getRegisteredServerToolAnnotations(toolName: string) {
  return getToolAnnotations(toolName);
}
