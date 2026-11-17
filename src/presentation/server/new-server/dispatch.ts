import { randomUUID } from "node:crypto";
import { conTiempoLimite, CupoDeLlamadas, ToolTimeoutError } from "./tool-guard";
import { authorizeTool, auditToolCall } from "../tool-auth";
import { getToolRisk } from "../tool-safety";
import { clavesDeRecurso, resourceLocks } from "./resource-lock";
import { idempotencyStore } from "./idempotency-store";

export type DispatchContext = {
  timeoutMs: number;
  cupo: CupoDeLlamadas;
  idempotencyKey?: string;
};

export function extractValidationError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Clasifica errores semánticos sin guardar la respuesta ni posibles datos sensibles. */
export function codigoDeFallo(resultado: unknown): string | undefined {
  if (!resultado || typeof resultado !== "object") return undefined;
  const value = resultado as {
    ok?: unknown;
    isError?: unknown;
    structuredContent?: { ok?: unknown };
  };
  if (value.isError === true || value.ok === false || value.structuredContent?.ok === false) {
    return "TOOL_RESULT_ERROR";
  }
  return undefined;
}

export async function dispatchValidated<T>(
  toolName: string,
  rawArgs: unknown,
  inputSchema: unknown,
  handler: (input: unknown, signal: AbortSignal) => Promise<T>,
  ctx: DispatchContext,
): Promise<T> {
  const correlationId = randomUUID();
  const operationId = safeOperationId(rawArgs);
  let parsed: unknown;
  try {
    parsed = validateInput(inputSchema, rawArgs);
  } catch (error) {
    auditToolCall(toolName, getToolRisk(toolName), false, "VALIDATION_FAILED", { correlationId, operationId });
    throw new InputValidationError(toolName, extractValidationError(error));
  }

  const parsedOperationId = safeOperationId(parsed) ?? operationId;
  const auth = authorizeTool(toolName, parsed, { correlationId, operationId: parsedOperationId });
  if (!auth.ok) {
    throw new ToolAuthorizationError(toolName, auth.code, auth.message);
  }

  if (!ctx.cupo.intentarEntrar()) {
    auditToolCall(toolName, getToolRisk(toolName), false, "CALL_CAPACITY_REACHED", {
      correlationId,
      operationId: parsedOperationId,
    });
    throw new ToolBusyError(toolName, ctx.cupo.activas);
  }
  const startedAt = performance.now();
  try {
    const keys = getToolRisk(toolName) === "read" ? [] : clavesDeRecurso(toolName, parsed);
    const result = await conTiempoLimite(
      toolName,
      ctx.timeoutMs,
      (signal) => {
        const action = () => resourceLocks.run(keys, signal, () => handler(parsed, signal));
        return ctx.idempotencyKey && getToolRisk(toolName) !== "read"
          ? idempotencyStore.run(ctx.idempotencyKey, toolName, parsed, action)
          : action();
      },
    );
    const failure = codigoDeFallo(result);
    auditToolCall(
      toolName,
      getToolRisk(toolName),
      failure === undefined,
      failure,
      { durationMs: performance.now() - startedAt, correlationId, operationId: operationIdFromResult(result) ?? parsedOperationId },
    );
    return result;
  } catch (error) {
    auditToolCall(
      toolName,
      getToolRisk(toolName),
      false,
      error instanceof ToolTimeoutError ? "TIMEOUT" : "TOOL_THROWN",
      { durationMs: performance.now() - startedAt, correlationId, operationId: parsedOperationId },
    );
    throw error;
  } finally {
    ctx.cupo.salir();
  }
}

function safeOperationId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>).operationId;
  return typeof value === "string" && /^[\w-]{8,80}$/.test(value) ? value : undefined;
}

function operationIdFromResult(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const value = result as { operationId?: unknown; data?: unknown; structuredContent?: { data?: unknown } };
  const candidates = [value.operationId, (value.data as { operationId?: unknown } | undefined)?.operationId,
    (value.structuredContent?.data as { operationId?: unknown } | undefined)?.operationId];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && /^[\w-]{8,80}$/.test(candidate));
}

export function validateInput(schema: unknown, input: unknown): unknown {
  if (!schema) return input ?? {};
  if (typeof schema === "object" && schema !== null && "parse" in (schema as Record<string, unknown>)) {
    return (schema as { parse: (v: unknown) => unknown }).parse(input ?? {});
  }
  if (typeof schema === "object" && schema !== null && "~standard" in (schema as Record<string, unknown>)) {
    const std = (schema as { "~standard": { validate: (v: unknown) => { value?: unknown; issues?: Array<{ message: string }> } } })["~standard"];
    const result = std.validate(input ?? {});
    if (!result || typeof result !== "object" || "issues" in result || result.value === undefined) {
      const issues = (result as { issues?: Array<{ message: string }> } | undefined)?.issues;
      throw new Error(issues?.map((i) => i.message).join("; ") || "Invalid input");
    }
    return result.value;
  }
  return input ?? {};
}

export class InputValidationError extends Error {
  constructor(readonly toolName: string, message: string) {
    super(`Entrada invalida para ${toolName}: ${message}`);
    this.name = "InputValidationError";
  }
}

export class ToolAuthorizationError extends Error {
  constructor(readonly toolName: string, readonly code: string, message: string) {
    super(message);
    this.name = "ToolAuthorizationError";
  }
}

export class ToolBusyError extends Error {
  constructor(readonly toolName: string, readonly activas: number) {
    super(`El servidor ya tiene ${activas} llamadas en curso: reintenta cuando alguna termine.`);
    this.name = "ToolBusyError";
  }
}
