import { randomUUID } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/server";

export function ok<T extends Record<string, unknown>>(
  data: T,
  options?: { startTime?: number },
): CallToolResult {
  const payload = {
    ok: true as const,
    schemaVersion: "1.0" as const,
    timestamp: new Date().toISOString(),
    requestId: `mcp-${randomUUID().slice(0, 8)}`,
    ...(options?.startTime != null ? { durationMs: Date.now() - options.startTime } : {}),
    ...data,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export function fail(
  code: string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
    retryable?: boolean;
    startTime?: number;
  },
): CallToolResult {
  const payload = {
    ok: false as const,
    schemaVersion: "1.0" as const,
    timestamp: new Date().toISOString(),
    requestId: `mcp-${randomUUID().slice(0, 8)}`,
    ...(options?.startTime != null ? { durationMs: Date.now() - options.startTime } : {}),
    error: {
      code,
      message,
      ...(options?.hint ? { hint: options.hint } : {}),
      ...(options?.retryable != null ? { retryable: options.retryable } : {}),
      ...(options?.details ? { details: options.details } : {}),
    },
  };

  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export function errorToFail(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
  options?: { details?: Record<string, unknown>; hint?: string; retryable?: boolean; startTime?: number },
): CallToolResult {
  const err = error as Error & { code?: string; details?: Record<string, unknown> };
  return fail(
    err.code ?? fallbackCode,
    err.message ?? fallbackMessage,
    { details: err.details, ...options },
  );
}
