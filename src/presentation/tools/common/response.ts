type ResponseOptions = { startTime?: number };

export function ok(data: unknown, options?: ResponseOptions) {
  return {
    ok: true,
    data,
    ...(options?.startTime !== undefined ? { durationMs: Date.now() - options.startTime } : {}),
  };
}

export function fail(code: string, message: string, options?: ResponseOptions) {
  return {
    ok: false,
    error: { code, message },
    ...(options?.startTime !== undefined ? { durationMs: Date.now() - options.startTime } : {}),
  };
}

export function errorToFail(err: unknown, options?: ResponseOptions) {
  const message = err instanceof Error ? err.message : String(err);
  return fail("INTERNAL_ERROR", message, options);
}