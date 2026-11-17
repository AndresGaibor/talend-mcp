import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod/v4";
import { codigoDeFallo, dispatchValidated, validateInput, InputValidationError, ToolAuthorizationError } from "../../src/presentation/server/new-server/dispatch";
import { CupoDeLlamadas } from "../../src/presentation/server/new-server/tool-guard";
import { authorizeTool } from "../../src/presentation/server/tool-auth";
import { validateHostHeader } from "../../src/presentation/server/new-server/http-routes";
import { OperationRegistry } from "../../src/modules/runs/application/operation-registry";

const originalCwd = process.cwd();
const originalLog = process.env.TALEND_MCP_LOG;
const auditSandbox = mkdtempSync(join(tmpdir(), "talend-dispatch-audit-"));
afterEach(() => {
  process.chdir(originalCwd);
  if (originalLog === undefined) delete process.env.TALEND_MCP_LOG;
  else process.env.TALEND_MCP_LOG = originalLog;
});
afterAll(() => rmSync(auditSandbox, { recursive: true, force: true }));

describe("dispatchValidated — validación antes del handler en todos los transportes", () => {
  const schema = z.object({ jobName: z.string().min(1) });

  test("args inválidos nunca llegan al handler", async () => {
    let called = false;
    const ctx = { timeoutMs: 1000, cupo: new CupoDeLlamadas(2) };
    await expect(
      dispatchValidated("talend_jobs_list", {}, schema, async () => { called = true; return "x"; }, ctx),
    ).rejects.toBeInstanceOf(InputValidationError);
    expect(called).toBe(false);
  });

  test("args válidos sí llegan al handler con defaults aplicados", async () => {
    const ctx = { timeoutMs: 1000, cupo: new CupoDeLlamadas(2) };
    const result = await dispatchValidated("talend_jobs_list", { jobName: "A" }, schema, async (input) => input, ctx);
    expect(result).toEqual({ jobName: "A" });
  });

  test("validateInput soporta schemas ~standard sin parse", () => {
    const fake = { "~standard": { validate: (v: unknown) => ({ value: v }) } };
    expect(validateInput(fake, { a: 1 })).toEqual({ a: 1 });
  });

  test("clasifica errores semanticos sin serializar el payload", () => {
    expect(codigoDeFallo({ isError: true, content: [{ text: "detalle sensible" }] })).toBe("TOOL_RESULT_ERROR");
    expect(codigoDeFallo({ structuredContent: { ok: false, error: "detalle sensible" } })).toBe("TOOL_RESULT_ERROR");
    expect(codigoDeFallo({ ok: false, token: "no debe registrarse" })).toBe("TOOL_RESULT_ERROR");
    expect(codigoDeFallo({ ok: true, data: "correcto" })).toBeUndefined();
  });

  test("audita saturación con correlación sin persistir la entrada", async () => {
    process.chdir(auditSandbox);
    rmSync(join(auditSandbox, ".talend-mcp"), { recursive: true, force: true });
    process.env.TALEND_MCP_LOG = "normal";
    const cupo = new CupoDeLlamadas(1);
    expect(cupo.intentarEntrar()).toBe(true);
    const sensitive = "secret-token-no-log";
    await expect(dispatchValidated("talend_jobs_list", { jobName: sensitive }, schema,
      async () => "unreachable", { timeoutMs: 1000, cupo })).rejects.toThrow("llamadas en curso");

    const line = readFileSync(join(auditSandbox, ".talend-mcp", "audit.jsonl"), "utf8").trim();
    const event = JSON.parse(line) as Record<string, unknown>;
    expect(event).toMatchObject({ tool: "talend_jobs_list", ok: false, detail: "CALL_CAPACITY_REACHED" });
    expect(event.correlationId).toMatch(/^[\w-]{8,80}$/);
    expect(line).not.toContain(sensitive);
    cupo.salir();
  });

  test("correlaciona el audit con el operationId devuelto por una operación async", async () => {
    process.chdir(auditSandbox);
    rmSync(join(auditSandbox, ".talend-mcp"), { recursive: true, force: true });
    process.env.TALEND_MCP_LOG = "normal";
    const operationId = "12345678-1234-1234-1234-123456789abc";
    await dispatchValidated("talend_runs_start_async", {}, undefined,
      async () => ({ structuredContent: { data: { operationId } } }),
      { timeoutMs: 1000, cupo: new CupoDeLlamadas(1) });
    const event = JSON.parse(readFileSync(join(auditSandbox, ".talend-mcp", "audit.jsonl"), "utf8").trim()) as Record<string, unknown>;
    expect(event.operationId).toBe(operationId);
    expect(event.correlationId).toMatch(/^[\w-]{8,80}$/);
  });

  test("audita solicitud de cancelación correlacionada sin incluir datos de ejecución", async () => {
    process.chdir(auditSandbox);
    rmSync(join(auditSandbox, ".talend-mcp"), { recursive: true, force: true });
    process.env.TALEND_MCP_LOG = "normal";
    const registry = new OperationRegistry();
    let started!: () => void;
    const running = new Promise<void>((resolve) => { started = resolve; });
    const operation = registry.start("run", async (signal) => {
      started();
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      return { ok: false, cancelled: true };
    });
    await running;
    registry.cancel(operation.operationId);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const events = readFileSync(join(auditSandbox, ".talend-mcp", "audit.jsonl"), "utf8")
      .trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.map((event) => event.detail)).toContain("OPERATION_CANCEL_REQUESTED");
    expect(events.map((event) => event.detail)).toContain("OPERATION_CANCELLED");
    expect(events.filter((event) => event.operationId === operation.operationId)).toHaveLength(3);
    expect(readFileSync(join(auditSandbox, ".talend-mcp", "audit.jsonl"), "utf8")).not.toContain("params");
  });
});

describe("authorizeTool — riesgo efectivo, no solo anotacion", () => {
  test("destructiva sin confirm es rechazada (RISK o CONFIRMATION)", () => {
    const result = authorizeTool("talend_delete_job", { jobName: "X" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["RISK_NOT_ALLOWED", "CONFIRMATION_REQUIRED"]).toContain(result.code);
  });

  test("destructiva con confirm y ALLOW_DESTRUCTIVE pasa", () => {
    const previous = process.env.TALEND_MCP_ALLOW_DESTRUCTIVE;
    process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = "1";
    try {
      const result = authorizeTool("talend_delete_job", { jobName: "X", confirm: true });
      expect(result.ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.TALEND_MCP_ALLOW_DESTRUCTIVE;
      else process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = previous;
    }
  });

  test("read siempre pasa", () => {
    expect(authorizeTool("talend_jobs_list", {}).ok).toBe(true);
  });
});

describe("validateHostHeader — DNS rebinding", () => {
  test("loopback pasa, externo no", () => {
    expect(validateHostHeader("127.0.0.1:3927", "127.0.0.1")).toBe(true);
    expect(validateHostHeader("example.com:3927", "127.0.0.1")).toBe(false);
    expect(validateHostHeader(undefined, "127.0.0.1")).toBe(false);
  });
});
