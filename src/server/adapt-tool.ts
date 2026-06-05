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

type TalendToolDef = ToolBase & {
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

type LegacyToolDef = ToolBase & {
  inputSchema: unknown;
  outputSchema?: unknown;
  handler: (input: unknown) => Promise<unknown>;
};

type PlainModuleTool = ToolBase & {
  inputSchema: unknown;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
  };
  handler: (input: unknown) => Promise<unknown>;
};

type ModuleToolWithJsonSchema = ToolBase & {
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

function isTalendToolDef(tool: unknown): tool is TalendToolDef {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "safety" in tool &&
    "title" in tool &&
    "category" in tool
  );
}

function isLegacyToolDef(tool: unknown): tool is LegacyToolDef {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "handler" in tool &&
    !("title" in tool) &&
    !("annotations" in tool)
  );
}

function isPlainJsonSchema(schema: unknown): schema is Record<string, unknown> {
  return typeof schema === "object" && schema !== null && "type" in schema;
}

function isZodSchema(schema: unknown): schema is z.ZodType<unknown> {
  return typeof schema === "object" && schema !== null && "parse" in schema;
}

function convertInputSchema(schema: unknown): unknown {
  if (isZodSchema(schema)) {
    try {
      return (schema as z.ZodType<unknown>).toJSONSchema();
    } catch {
      return schema;
    }
  }
  if (isPlainJsonSchema(schema)) {
    return schema;
  }
  return schema;
}

function extractAnnotations(tool: unknown): McpToolAnnotation | undefined {
  if (isTalendToolDef(tool)) {
    return {
      readOnlyHint: tool.safety.readOnlyHint,
      idempotentHint: tool.safety.idempotentHint,
      destructiveHint: tool.safety.destructiveHint,
      openWorldHint: tool.safety.openWorldHint,
      requiresConfirmation: tool.safety.requiresConfirmation,
    };
  }

  const annotations = (tool as any)?.annotations;
  if (annotations && typeof annotations === "object") {
    const { readOnly, destructive } = annotations;
    return {
      readOnlyHint: readOnly === true,
      idempotentHint: readOnly === true,
      destructiveHint: destructive === true,
      requiresConfirmation: destructive === true,
    };
  }

  const safety = (tool as any)?.safety;
  if (safety && typeof safety === "object") {
    const { readOnly, destructive } = safety;
    return {
      readOnlyHint: readOnly === true,
      idempotentHint: readOnly === true,
      destructiveHint: destructive === true,
      requiresConfirmation: destructive === true,
    };
  }

  return undefined;
}

export function adaptToolToMcp(tool: unknown): McpToolDefinition {
  if (isTalendToolDef(tool)) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: convertInputSchema(tool.inputSchema),
      outputSchema: convertInputSchema(tool.outputSchema),
      annotations: extractAnnotations(tool),
      _meta: (tool as any)._meta,
    };
  }

  if (isLegacyToolDef(tool)) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
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
        outputSchema: t.outputSchema ? convertInputSchema(t.outputSchema) : undefined,
        annotations: extractAnnotations(t),
        _meta: t._meta,
      };
    }
  }

  throw new Error(`Tipo de herramienta desconocido: ${JSON.stringify(tool)}`);
}
