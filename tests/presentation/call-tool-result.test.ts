import { describe, expect, test } from "bun:test";
import { toCallToolResult } from "../../src/presentation/server/call-tool-result";

describe("resultado de tool para el protocolo MCP", () => {
  test("envuelve el envelope y lo publica como structuredContent", () => {
    const envelope = { ok: true, source: "talend_jobs_list", confidence: "high", data: { total: 0 } };
    const result = toCallToolResult(envelope);
    expect(result.structuredContent).toEqual(envelope);
    expect(result.isError).toBeUndefined();
  });

  test("marca isError cuando el envelope trae ok:false", () => {
    const envelope = { ok: false, error: { code: "NOT_FOUND", message: "no existe" } };
    const result = toCallToolResult(envelope);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(envelope);
  });

  test("respeta un CallToolResult que ya viene armado", () => {
    const result = { content: [{ type: "text", text: "hola" }], isError: false };
    expect(toCallToolResult(result)).toBe(result);
  });

  test("serializa texto plano sin structuredContent", () => {
    const result = toCallToolResult("texto");
    expect(result).toEqual({ content: [{ type: "text", text: "texto" }] });
  });
});
