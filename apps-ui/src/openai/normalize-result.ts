export interface NormalizedResult<T = unknown> {
  ok: boolean;
  success: boolean;
  data?: T;
  text?: string;
  result?: string;
  error?: string;
  raw?: unknown;
  warnings?: string[];
  nextActions?: Array<{ label: string; toolName: string; input?: Record<string, unknown> }>;
}

export function normalizeToolResult<T = unknown>(raw: unknown): NormalizedResult<T> {
  const err = (msg: string): NormalizedResult<T> => ({
    ok: false, success: false, error: msg, raw,
  });

  if (!raw || typeof raw !== "object") {
    return err("Resultado inválido o vacío");
  }

  const anyRaw = raw as Record<string, unknown>;

  // 1. Formato MCP { content, structuredContent? }
  if (Array.isArray(anyRaw.content)) {
    const textContent = (anyRaw.content as Array<{ type: string; text: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const sc = anyRaw.structuredContent as Record<string, unknown> | undefined;
    const isOk = anyRaw.isError !== true;

    if (sc && typeof sc.ok === "boolean") {
      const talendOk = sc.ok === true && isOk;

      return {
        ok: talendOk,
        success: talendOk,
        data: sc.data as T,
        text: textContent,
        result: textContent,
        error: talendOk ? undefined : extractErrorMessage(sc),
        raw,
        warnings: sc.warnings as string[] | undefined,
        nextActions: sc.nextActions as NormalizedResult["nextActions"] | undefined,
      };
    }

    return {
      ok: isOk,
      success: isOk,
      data: (sc ?? tryParseJson<T>(textContent)) as T,
      text: textContent,
      result: textContent,
      error: isOk ? undefined : ((sc?.errors as string) ?? textContent),
      raw,
      warnings: (sc?.warnings as string[]) ?? undefined,
      nextActions: (sc?.nextActions as NormalizedResult["nextActions"]) ?? undefined,
    };
  }

  // 2. TalendResult unificado { ok, data?, errors?, warnings? }
  if (typeof anyRaw.ok === "boolean") {
    if (anyRaw.ok) {
      const data = anyRaw.data as T;
      const text = typeof data === "string" ? data : JSON.stringify(data);
      return {
        ok: true, success: true, data, text, result: text, raw,
        warnings: (anyRaw.warnings as string[]) ?? undefined,
        nextActions: (anyRaw.nextActions as NormalizedResult["nextActions"]) ?? undefined,
      };
    }
    return {
      ok: false, success: false, error: extractErrorMessage(anyRaw), raw,
    };
  }

  // 3. Formato legacy { success, result? }
  if (typeof anyRaw.success === "boolean") {
    if (anyRaw.success) {
      const data: T = tryParseJson<T>(anyRaw.result as string) ?? (anyRaw.result as T);
      const text = typeof anyRaw.result === "string" ? anyRaw.result : JSON.stringify(anyRaw.result);
      return { ok: true, success: true, data, text, result: text, raw };
    }
    return {
      ok: false, success: false, error: (anyRaw.error as string) ?? "Error desconocido", raw,
    };
  }

  // 4. Desconocido
  return err("Formato de resultado desconocido");
}

function tryParseJson<T>(text: unknown): T | undefined {
  if (typeof text !== "string") return undefined;
  try { return JSON.parse(text) as T; }
  catch { return undefined; }
}

function extractErrorMessage(obj: Record<string, unknown>): string {
  const err = obj.errors as Array<{ message: string }> | undefined;
  if (err?.[0]?.message) return err[0].message;
  return (obj.error as string) ?? "Error en la herramienta";
}
