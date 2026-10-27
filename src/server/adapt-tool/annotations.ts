import type { McpToolAnnotation } from "./types";
import { isTalendToolDef } from "./schema-guards";

export function extractAnnotations(tool: unknown): McpToolAnnotation | undefined {
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
      openWorldHint: tool.safety.openWorldHint ?? !tool.safety.readOnlyHint,
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
      openWorldHint: readOnly !== true,
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
      openWorldHint: !resolvedReadOnly,
      requiresConfirmation: requiresConfirmation === true || destructive === true || isVerbDestructive,
    };
  }

  return baseAnn;
}
