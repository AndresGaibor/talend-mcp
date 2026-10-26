import type { z } from "zod/v4";

export type McpToolAnnotation = {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
  requiresConfirmation?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  annotations?: McpToolAnnotation;
  _meta?: Record<string, unknown>;
};

type ToolBase = {
  name: string;
  description: string;
};

export type TalendToolDef = ToolBase & {
  title: string;
  category: string;
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  safety: {
    readOnlyHint: boolean;
    idempotentHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
    requiresWorkspace?: boolean;
    requiresConfirmation?: boolean;
    risk: "low" | "medium" | "high";
  };
  handler: (input: unknown, ctx: unknown) => Promise<unknown>;
};

export type LegacyToolDef = ToolBase & {
  inputSchema: unknown;
  outputSchema?: unknown;
  handler: (input: unknown) => Promise<unknown>;
};

export type PlainModuleTool = ToolBase & {
  inputSchema: unknown;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
  };
  handler: (input: unknown) => Promise<unknown>;
};

export type ModuleToolWithJsonSchema = ToolBase & {
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  outputSchema?: unknown;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
  };
  handler: (input: unknown) => Promise<unknown>;
};
