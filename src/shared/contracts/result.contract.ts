export type Confidence = "high" | "medium" | "low" | "none";

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
