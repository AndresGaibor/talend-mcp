/**
 * Normaliza la salida de un handler al formato de resultado MCP.
 *
 * Los handlers que ya devuelven un CallToolResult (content, structuredContent,
 * isError) se respetan tal cual. Los que devuelven el envelope TalendResult
 * exponen el envelope tambien como structuredContent, que es lo que exige el
 * protocolo cuando la tool declara un outputSchema. Un envelope con `ok:false`
 * se marca como `isError` para que el cliente no lo trate como exito.
 *
 * Vive en su propio modulo para que quien solo necesita esta funcion (las
 * pruebas, por ejemplo) no cargue el servidor ni el registro completo de tools.
 */
export function toCallToolResult(result: unknown): Record<string, unknown> {
  if (result && typeof result === "object" && Array.isArray((result as { content?: unknown }).content)) {
    return result as Record<string, unknown>;
  }

  const text = typeof result === "string" ? result : JSON.stringify(result);
  const payload: Record<string, unknown> = { content: [{ type: "text", text }] };

  if (result && typeof result === "object" && typeof (result as { ok?: unknown }).ok === "boolean") {
    payload.structuredContent = result;
    if ((result as { ok: boolean }).ok === false) payload.isError = true;
  }

  return payload;
}
