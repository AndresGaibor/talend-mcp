import type { z } from "zod/v4";
import { TalendResultSchema } from "../shared/contracts/result.contract";
import { hasEnrichedDataSchema, getEnrichedOutputSchema } from "./enriched-schemas";

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

function sanitizeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema);
  }
  if (schema && typeof schema === "object") {
    const obj = schema as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "$schema" || key === "propertyNames") {
        continue;
      }
      res[key] = sanitizeSchema(val);
    }
    return res;
  }
  return schema;
}

function removeDefaultedRequiredFields(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(removeDefaultedRequiredFields);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const obj = schema as Record<string, unknown>;
  const cloned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = removeDefaultedRequiredFields(value);
  }

  if (
    cloned.type === "object" &&
    cloned.properties &&
    typeof cloned.properties === "object" &&
    Array.isArray(cloned.required)
  ) {
    const properties = cloned.properties as Record<string, Record<string, unknown>>;

    cloned.required = cloned.required.filter((field) => {
      const prop = properties[String(field)];
      return prop?.default === undefined;
    });
  }

  return cloned;
}

export function convertInputSchema(schema: unknown): unknown {
  let result: unknown;
  if (isZodSchema(schema)) {
    try {
      result = (schema as z.ZodType<unknown>).toJSONSchema();
    } catch {
      result = schema;
    }
  } else if (schema && typeof schema === "object" && "~standard" in schema) {
    try {
      const std = (schema as any)["~standard"];
      if (std && std.jsonSchema && typeof std.jsonSchema.input === "function") {
        result = std.jsonSchema.input();
      } else {
        result = schema;
      }
    } catch {
      result = schema;
    }
  } else if (isPlainJsonSchema(schema)) {
    result = schema;
  } else {
    result = schema;
  }
  return removeDefaultedRequiredFields(sanitizeSchema(result));
}

function extractAnnotations(tool: unknown): McpToolAnnotation | undefined {
  let name = "";
  if (isTalendToolDef(tool)) {
    name = tool.name;
  } else {
    name = (tool as any)?.name || "";
  }

  const nameLower = name.toLowerCase();

  // Determine if it matches any destructive verb
  const isVerbDestructive = ["create", "apply", "patch", "restore", "delete"].some(verb => 
    nameLower.includes(verb)
  );

  // Determine if it is a read-only tool based on common verbs
  const isReadOnlyVerb = ["list", "read", "inspect", "infer", "scan", "diagnose", "stats", "explain", "suggest", "validate", "get", "preview", "ping", "status", "recent", "state", "markers", "summarize", "find", "info", "generate"].some(verb => 
    nameLower.includes(verb)
  );

  const isReadOnly = isReadOnlyVerb && !isVerbDestructive;

  const baseAnn: McpToolAnnotation = {
    readOnlyHint: isReadOnly,
    idempotentHint: isReadOnly,
    destructiveHint: isVerbDestructive,
    openWorldHint: !isReadOnly,
    requiresConfirmation: isVerbDestructive,
  };

  if (isTalendToolDef(tool)) {
    return {
      readOnlyHint: tool.safety.readOnlyHint,
      idempotentHint: tool.safety.idempotentHint,
      destructiveHint: tool.safety.destructiveHint,
      openWorldHint: tool.safety.openWorldHint,
      requiresConfirmation: tool.safety.requiresConfirmation === true || isVerbDestructive,
    };
  }

  const annotations = (tool as any)?.annotations;
  if (annotations && typeof annotations === "object") {
    const { readOnly, destructive, requiresConfirmation } = annotations as any;
    return {
      readOnlyHint: readOnly === true,
      idempotentHint: readOnly === true,
      destructiveHint: destructive === true || isVerbDestructive,
      requiresConfirmation: requiresConfirmation === true || destructive === true || isVerbDestructive,
    };
  }

  const safety = (tool as any)?.safety;
  if (safety && typeof safety === "object") {
    const { readOnly, destructive, requiresConfirmation, permissions } = safety as any;
    const resolvedReadOnly = readOnly === true || permissions === "read" || isReadOnly;
    return {
      readOnlyHint: resolvedReadOnly,
      idempotentHint: resolvedReadOnly,
      destructiveHint: destructive === true || isVerbDestructive,
      requiresConfirmation: requiresConfirmation === true || destructive === true || isVerbDestructive,
    };
  }

  return baseAnn;
}

function resolveOutputSchema(toolName: string, fallbackSchema: unknown): unknown {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  if (hasEnrichedDataSchema(normName)) {
    const isPatternB = normName === "talend_diagnose_environment" ||
      normName.startsWith("talend_secrets_") ||
      normName.startsWith("talend_snapshots_") ||
      normName.startsWith("talend_datasets_") ||
      normName.startsWith("talend_deliverables_") ||
      normName.startsWith("talend_errors_") ||
      normName.startsWith("talend_validation_") ||
      normName.startsWith("talend_evidence_") ||
      normName.startsWith("talend_report_snippets_") ||
      normName.startsWith("talend_runs_") ||
      normName.startsWith("talend_app_");
    return convertInputSchema(getEnrichedOutputSchema(normName, isPatternB ? "B" : "A"));
  }
  return convertInputSchema(fallbackSchema ?? TalendResultSchema);
}

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
