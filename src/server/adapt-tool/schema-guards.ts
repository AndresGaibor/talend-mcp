import type { z } from "zod/v4";
import type { LegacyToolDef, TalendToolDef } from "./types";

export function isTalendToolDef(tool: unknown): tool is TalendToolDef {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "safety" in tool &&
    "title" in tool &&
    "category" in tool
  );
}

export function isLegacyToolDef(tool: unknown): tool is LegacyToolDef {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "handler" in tool &&
    !("title" in tool) &&
    !("annotations" in tool)
  );
}

export function isPlainJsonSchema(schema: unknown): schema is Record<string, unknown> {
  return typeof schema === "object" && schema !== null && "type" in schema;
}

export function isZodSchema(schema: unknown): schema is z.ZodType<unknown> {
  return typeof schema === "object" && schema !== null && "parse" in schema;
}
