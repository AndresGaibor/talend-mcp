import { z } from "zod/v4";

export type Confidence = "high" | "medium" | "low" | "none";

/**
 * Zod schema for the standard TalendResult envelope.
 * Use this as `outputSchema` in tool definitions so MCP clients
 * (e.g. ChatGPT Actions) know the shape of every tool response.
 */
export const TalendResultSchema = z.object({
  ok: z.boolean().describe("Whether the operation succeeded"),
  source: z.string().describe("Tool name that produced this result"),
  confidence: z.enum(["high", "medium", "low", "none"]).describe("Confidence level of the result"),
  data: z.unknown().optional().describe("The result payload (shape varies per tool)"),
  warnings: z.array(z.string()).optional().describe("Non-fatal warnings"),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
  ).optional().describe("Errors if ok is false"),
  nextActions: z.array(
    z.object({
      label: z.string(),
      toolName: z.string(),
      input: z.record(z.string(), z.unknown()).optional(),
    })
  ).optional().describe("Suggested follow-up tool calls"),
});

export type TalendResult<T = unknown> = {
  ok: boolean;
  source: string;
  confidence: Confidence;
  data?: T;
  warnings?: string[];
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  nextActions?: Array<{
    label: string;
    toolName: string;
    input?: Record<string, unknown>;
  }>;
};

export function okResult<T>(
  data: T,
  source: string,
  confidence: Confidence = "high",
  options?: {
    warnings?: string[];
    nextActions?: TalendResult["nextActions"];
  },
): TalendResult<T> {
  return {
    ok: true,
    source,
    confidence,
    data,
    ...(options?.warnings && options.warnings.length > 0 ? { warnings: options.warnings } : {}),
    ...(options?.nextActions && options.nextActions.length > 0 ? { nextActions: options.nextActions } : {}),
  };
}

export function errorResult<T = unknown>(
  source: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  options?: {
    confidence?: Confidence;
    warnings?: string[];
    nextActions?: TalendResult["nextActions"];
  },
): TalendResult<T> {
  return {
    ok: false,
    source,
    confidence: options?.confidence ?? "none",
    errors: [{ code, message, details }],
    ...(options?.warnings && options.warnings.length > 0 ? { warnings: options.warnings } : {}),
    ...(options?.nextActions && options.nextActions.length > 0 ? { nextActions: options.nextActions } : {}),
  };
}

export function warningResult<T>(
  data: T,
  source: string,
  warnings: string[],
  options?: {
    confidence?: Confidence;
    nextActions?: TalendResult["nextActions"];
  },
): TalendResult<T> {
  return {
    ok: true,
    source,
    confidence: options?.confidence ?? "medium",
    data,
    warnings,
    ...(options?.nextActions && options.nextActions.length > 0 ? { nextActions: options.nextActions } : {}),
  };
}
