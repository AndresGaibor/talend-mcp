/**
 * Representa un resultado de herramienta normalizado.
 */
export interface NormalizedResult<T = unknown> {
  ok: boolean;
  data?: T;
  text?: string;
  error?: string;
  raw?: unknown;
  // Compatibilidad hacia atrás para facilitar la migración
  success: boolean;
  result?: string;
}

/**
 * Normaliza los resultados de las herramientas desde diferentes formatos (legado y MCP).
 * 
 * @param raw El resultado crudo de la herramienta.
 * @returns El resultado normalizado.
 */
export function normalizeToolResult<T = unknown>(raw: unknown): NormalizedResult<T> {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      success: false,
      error: "Resultado inválido o vacío",
      raw
    };
  }

  const anyRaw = raw as any;
  let normalized: Partial<NormalizedResult<T>> = { raw };

  // 1. Manejar formato MCP { content, structuredContent? }
  if (Array.isArray(anyRaw.content)) {
    const textContent = anyRaw.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    let parsedData: T | undefined;
    try {
      parsedData = JSON.parse(textContent);
    } catch {
      parsedData = undefined;
    }

    const isOk = anyRaw.isError !== true;
    let errorMsg: string | undefined = undefined;
    if (!isOk) {
      errorMsg = anyRaw.error || textContent || "Error en la herramienta";
    } else if (anyRaw.structuredContent?.errors && Array.isArray(anyRaw.structuredContent.errors)) {
      errorMsg = anyRaw.structuredContent.errors.join("\n");
    }

    normalized = {
      ...normalized,
      ok: isOk,
      success: isOk,
      data: (anyRaw.structuredContent !== undefined ? anyRaw.structuredContent : parsedData) as T,
      text: textContent,
      result: textContent,
      error: errorMsg,
    };
  }
  // 2. Manejar formato TalendToolResult { ok, data?, error? }
  else if ("ok" in anyRaw) {
    if (anyRaw.ok) {
      normalized = {
        ...normalized,
        ok: true,
        success: true,
        data: anyRaw.data as T,
        text: typeof anyRaw.data === "string" ? anyRaw.data : JSON.stringify(anyRaw.data),
        result: typeof anyRaw.data === "string" ? anyRaw.data : JSON.stringify(anyRaw.data)
      };
    } else {
      normalized = {
        ...normalized,
        ok: false,
        success: false,
        error: anyRaw.error?.message || anyRaw.error || "Error en la herramienta"
      };
    }
  }
  // 3. Manejar formato legado { success, result?, error? }
  else if ("success" in anyRaw) {
    if (anyRaw.success) {
      let data: T | undefined;
      try {
        if (typeof anyRaw.result === "string") {
          data = JSON.parse(anyRaw.result);
        } else {
          data = anyRaw.result;
        }
      } catch {
        data = anyRaw.result;
      }

      const textValue = typeof anyRaw.result === "string" ? anyRaw.result : JSON.stringify(anyRaw.result);
      normalized = {
        ...normalized,
        ok: true,
        success: true,
        data,
        text: textValue,
        result: textValue
      };
    } else {
      normalized = {
        ...normalized,
        ok: false,
        success: false,
        error: anyRaw.error || "Error desconocido en la herramienta (legado)"
      };
    }
  }
  // 3. Formato desconocido
  else {
    normalized = {
      ...normalized,
      ok: false,
      success: false,
      error: "Formato de resultado desconocido de la herramienta"
    };
  }

  return normalized as NormalizedResult<T>;
}
