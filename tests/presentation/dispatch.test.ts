import { describe, expect, test } from "bun:test";
import { z } from "zod/v4";
import { dispatchValidated, validateInput, InputValidationError, ToolAuthorizationError } from "../../src/presentation/server/new-server/dispatch";
import { CupoDeLlamadas } from "../../src/presentation/server/new-server/tool-guard";
import { authorizeTool } from "../../src/presentation/server/tool-auth";
import { validateHostHeader } from "../../src/presentation/server/new-server/http-routes";

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
