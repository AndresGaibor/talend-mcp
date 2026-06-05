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

  it("debe desenvolver structuredContent cuando es TalendResult con ok=true", () => {
    const talendResult = {
      ok: true,
      source: "talend_jobs_list",
      confidence: "high" as const,
      data: { jobs: [{ name: "Job1", status: "production" }], count: 1 },
      warnings: ["test warning"],
    };
    const raw = {
      content: [{ type: "text", text: "Jobs listados" }],
      structuredContent: talendResult,
      isError: false,
    };
    const normalized = normalizeToolResult<typeof talendResult.data>(raw);
    expect(normalized.ok).toBe(true);
    expect(normalized.success).toBe(true);
    expect(normalized.data).toEqual({ jobs: [{ name: "Job1", status: "production" }], count: 1 });
    expect(normalized.warnings).toEqual(["test warning"]);
  });

  it("debe desenvolver structuredContent cuando es TalendResult con ok=false", () => {
    const talendResult = {
      ok: false,
      source: "talend_jobs_list",
      confidence: "none" as const,
      errors: [{ code: "NOT_FOUND", message: "Job no encontrado" }],
    };
    const raw = {
      content: [{ type: "text", text: "Error listando jobs" }],
      structuredContent: talendResult,
      isError: false,
    };
    const normalized = normalizeToolResult(raw);
    expect(normalized.ok).toBe(false);
    expect(normalized.success).toBe(false);
    expect(normalized.error).toContain("Job no encontrado");
  });

  it("debe extraer data interno de TalendResult, no el wrapper completo", () => {
    const innerData = { catalogPath: "/path/to/catalog", items: ["a", "b"] };
    const talendResult = {
      ok: true,
      source: "talend_components_catalog_status",
      confidence: "high" as const,
      data: innerData,
    };
    const raw = {
      content: [{ type: "text", text: "Catálogo encontrado" }],
      structuredContent: talendResult,
      isError: false,
    };
    const normalized = normalizeToolResult<typeof innerData>(raw);
    expect(normalized.data).toEqual(innerData);
    expect((normalized.data as any)?.catalogPath).toBe("/path/to/catalog");
  });
