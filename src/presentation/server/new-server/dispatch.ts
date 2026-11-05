import { conTiempoLimite, CupoDeLlamadas, ToolTimeoutError } from "./tool-guard";
import { authorizeTool, auditToolCall } from "../tool-auth";
import { getToolRisk } from "../tool-safety";

export type DispatchContext = {
  timeoutMs: number;
  cupo: CupoDeLlamadas;
};

export function extractValidationError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function dispatchValidated<T>(
  toolName: string,
  rawArgs: unknown,
  inputSchema: unknown,
  handler: (input: unknown, signal: AbortSignal) => Promise<T>,
  ctx: DispatchContext,
): Promise<T> {
  let parsed: unknown;
  try {
    parsed = validateInput(inputSchema, rawArgs);
  } catch (error) {
    auditToolCall(toolName, getToolRisk(toolName), false, "VALIDATION_FAILED");
    throw new InputValidationError(toolName, extractValidationError(error));
  }

  const auth = authorizeTool(toolName, parsed);
  if (!auth.ok) {
    throw new ToolAuthorizationError(toolName, auth.code, auth.message);
  }

  if (!ctx.cupo.intentarEntrar()) {
    throw new ToolBusyError(toolName, ctx.cupo.activas);
  }
  try {
    const result = await conTiempoLimite(toolName, ctx.timeoutMs, (signal) => handler(parsed, signal));
    auditToolCall(toolName, getToolRisk(toolName), true);
    return result;
  } catch (error) {
    if (error instanceof ToolTimeoutError) {
      auditToolCall(toolName, getToolRisk(toolName), false, "TIMEOUT");
    }
    throw error;
  } finally {
    ctx.cupo.salir();
  }
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
