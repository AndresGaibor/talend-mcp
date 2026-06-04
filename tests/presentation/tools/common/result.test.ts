import { describe, expect, test } from "bun:test";
import {
  okResult,
  errorResult,
  warningResult,
  toTalendToolResult,
  type TalendToolResult,
} from "../../../../src/presentation/tools/common/result";

describe("TalendToolResult", () => {
  describe("okResult", () => {
    test("crea resultado exitoso con data", () => {
      const result = okResult({ jobs: ["job1", "job2"] }, "list-jobs");
      expect(result.ok).toBe(true);
      expect(result.source).toBe("list-jobs");
      expect(result.confidence).toBe("high");
      expect(result.data).toEqual({ jobs: ["job1", "job2"] });
      expect(result.errors).toBeUndefined();
    });

    test("crea resultado exitoso con confidence personalizado", () => {
      const result = okResult({ count: 5 }, "count-jobs", "medium");
      expect(result.ok).toBe(true);
      expect(result.confidence).toBe("medium");
    });

    test("crea resultado exitoso con warnings", () => {
      const result = okResult({ jobs: [] }, "list-jobs", "high", {
        warnings: ["No jobs found in project"],
      });
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual(["No jobs found in project"]);
    });

    test("crea resultado exitoso con nextActions", () => {
      const result = okResult({ jobName: "test" }, "create-job", "high", {
        nextActions: [{ label: "Open job", toolName: "talend_read_job", input: { jobName: "test" } }],
      });
      expect(result.nextActions).toHaveLength(1);
      expect(result.nextActions![0]!.label).toBe("Open job");
    });

    test("no incluye data undefined", () => {
      const result = okResult(undefined as unknown as object, "test");
      expect(result.data).toBeUndefined();
    });
  });

  describe("errorResult", () => {
    test("crea resultado de error", () => {
      const result = errorResult("read-job", "JOB_NOT_FOUND", "Job no encontrado");
      expect(result.ok).toBe(false);
      expect(result.source).toBe("read-job");
      expect(result.confidence).toBe("none");
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]!.code).toBe("JOB_NOT_FOUND");
      expect(result.errors![0]!.message).toBe("Job no encontrado");
    });

    test("crea resultado de error con details", () => {
      const result = errorResult("create-job", "CREATE_ERROR", "Error creando job", { jobName: "test" });
      expect(result.errors![0]!.details).toEqual({ jobName: "test" });
    });

    test("crea resultado de error con confidence personalizado", () => {
      const result = errorResult("list-jobs", "PARTIAL_ERROR", "Partial failure", undefined, { confidence: "low" });
      expect(result.confidence).toBe("low");
    });

    test("crea resultado de error con warnings", () => {
      const result = errorResult("read-job", "ERROR", "Error", undefined, { warnings: ["Fallback used"] });
      expect(result.warnings).toEqual(["Fallback used"]);
    });
  });

  describe("warningResult", () => {
    test("crea resultado con warning (ok=true pero confidence reducida)", () => {
      const result = warningResult({ jobs: ["old-job"] }, "list-jobs", ["Using cached data"]);
      expect(result.ok).toBe(true);
      expect(result.confidence).toBe("medium");
      expect(result.warnings).toEqual(["Using cached data"]);
      expect(result.data).toEqual({ jobs: ["old-job"] });
    });

    test("crea resultado warning con nextActions", () => {
      const result = warningResult({ count: 0 }, "count-jobs", ["No context configured"], {
        nextActions: [{ label: "Create context", toolName: "talend_create_context" }],
      });
      expect(result.nextActions).toHaveLength(1);
    });
  });

  describe("toTalendToolResult", () => {
    test("pasa a través resultado existente", () => {
      const original = okResult({ test: true }, "test-source");
      const converted = toTalendToolResult<{ test: boolean }>(original);
      expect(converted).toEqual(original);
    });

    test("convierte resultado no válido a error", () => {
      const invalid = { data: "not a TalendToolResult" } as TalendToolResult<string>;
      const converted = toTalendToolResult(invalid);
      expect(converted.ok).toBe(false);
      expect(converted.errors).toBeDefined();
      expect(converted.errors![0]!.code).toBe("INVALID_RESULT");
    });
  });

  describe("structure compliance", () => {
    test("okResult tiene todos los campos requeridos", () => {
      const result = okResult({ data: "test" }, "test-tool");
      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("confidence");
      expect(result.ok).toBe(true);
    });

    test("errorResult tiene todos los campos requeridos", () => {
      const result = errorResult("test-tool", "ERR", "Error message");
      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("errors");
      expect(result.ok).toBe(false);
    });

    test("confianza solo acepta valores válidos", () => {
      const validConfidences: Array<"high" | "medium" | "low" | "none"> = ["high", "medium", "low", "none"];
      for (const conf of validConfidences) {
        const result = okResult({ test: true }, "test", conf);
        expect(result.confidence).toBe(conf);
      }
    });
  });
});