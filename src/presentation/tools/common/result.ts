export type TalendToolResult<T = unknown> = {
  ok: boolean;
  source: string;
  confidence: "high" | "medium" | "low" | "none";
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

export type Confidence = "high" | "medium" | "low" | "none";

function createResult<T>(params: {
  ok: boolean;
  source: string;
  confidence: Confidence;
  data?: T;
  warnings?: string[];
  errors?: TalendToolResult["errors"];
  nextActions?: TalendToolResult["nextActions"];
}): TalendToolResult<T> {
  return {
    ok: params.ok,
    source: params.source,
    confidence: params.confidence,
    ...(params.data !== undefined ? { data: params.data } : {}),
    ...(params.warnings && params.warnings.length > 0 ? { warnings: params.warnings } : {}),
    ...(params.errors && params.errors.length > 0 ? { errors: params.errors } : {}),
    ...(params.nextActions && params.nextActions.length > 0 ? { nextActions: params.nextActions } : {}),
  };
}

export function okResult<T>(
  data: T,
  source: string,
  confidence: Confidence = "high",
  options?: {
    warnings?: string[];
    nextActions?: TalendToolResult["nextActions"];
  }
): TalendToolResult<T> {
  return createResult({
    ok: true,
    source,
    confidence,
    data,
    warnings: options?.warnings,
    nextActions: options?.nextActions,
  });
}

export function errorResult<T = unknown>(
  source: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  options?: {
    confidence?: Confidence;
    warnings?: string[];
    nextActions?: TalendToolResult["nextActions"];
  }
): TalendToolResult<T> {
  return createResult<T>({
    ok: false,
    source,
    confidence: options?.confidence ?? "none",
    errors: [{ code, message, details }],
    warnings: options?.warnings,
    nextActions: options?.nextActions,
  });
}

export function warningResult<T>(
  data: T,
  source: string,
  warnings: string[],
  options?: {
    confidence?: Confidence;
    nextActions?: TalendToolResult["nextActions"];
  }
): TalendToolResult<T> {
  return createResult({
    ok: true,
    source,
    confidence: options?.confidence ?? "medium",
    data,
    warnings,
    nextActions: options?.nextActions,
  });
}

export function toTalendToolResult<T>(
  result: TalendToolResult<T> | unknown
): TalendToolResult<T> {
  if (result && typeof result === "object" && "ok" in result) {
    return result as TalendToolResult<T>;
  }
  return errorResult("unknown", "INVALID_RESULT", "Resultado no es un TalendToolResult válido");
}