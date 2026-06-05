import { describe, it, expect } from "vitest";
import { normalizeToolResult } from "./normalize-result";

describe("normalizeToolResult", () => {
  it("debe normalizar formato legado exitoso", () => {
    const raw = { success: true, result: JSON.stringify({ foo: "bar" }) };
    const normalized = normalizeToolResult<{ foo: string }>(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.data).toEqual({ foo: "bar" });
    expect(normalized.text).toBe(raw.result);
  });

  it("debe normalizar formato legado con error", () => {
    const raw = { success: false, error: "Algo salió mal" };
    const normalized = normalizeToolResult(raw);
    expect(normalized.ok).toBe(false);
    expect(normalized.error).toBe("Algo salió mal");
  });

  it("debe normalizar formato MCP con contenido de texto", () => {
    const raw = {
      content: [{ type: "text", text: "Hola Mundo" }],
    };
    const normalized = normalizeToolResult(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.text).toBe("Hola Mundo");
  });

  it("debe normalizar formato MCP con structuredContent", () => {
    const raw = {
      content: [{ type: "text", text: "Resultado" }],
      structuredContent: { bar: "baz" },
    };
    const normalized = normalizeToolResult<{ bar: string }>(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.data).toEqual({ bar: "baz" });
    expect(normalized.text).toBe("Resultado");
  });

  it("debe manejar formatos desconocidos como errores", () => {
    const raw = { algo: "raro" };
    const normalized = normalizeToolResult(raw);
    expect(normalized.ok).toBe(false);
    expect(normalized.error).toContain("Formato de resultado desconocido");
  });

  it("debe normalizar formato MCP con JSON sólo en content", () => {
    const sessionObj = { id: "test-session", projectPath: "/foo" };
    const raw = {
      content: [{ type: "text", text: JSON.stringify(sessionObj) }],
      isError: false,
    };
    const normalized = normalizeToolResult<typeof sessionObj>(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.data).toEqual(sessionObj);
  });

  it("debe normalizar formato MCP con structuredContent", () => {
    const sessionObj = { id: "test-session", projectPath: "/foo" };
    const raw = {
      content: [{ type: "text", text: "Sesión cargada" }],
      structuredContent: sessionObj,
      isError: false,
    };
    const normalized = normalizeToolResult<typeof sessionObj>(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.data).toEqual(sessionObj);
    expect(normalized.text).toBe("Sesión cargada");
  });

  it("debe normalizar formato MCP con isError: true", () => {
    const raw = {
      content: [{ type: "text", text: "Algo falló en la sesión" }],
      isError: true,
      error: "Error grave de sesión",
    };
    const normalized = normalizeToolResult(raw);
    expect(normalized.ok).toBe(false);
    expect(normalized.error).toBe("Error grave de sesión");
  });
});
