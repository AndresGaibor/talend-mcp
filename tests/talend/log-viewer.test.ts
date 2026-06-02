import { describe, expect, test } from "bun:test";
import { analyzeJobLogs, formatLogLines, readLogContent } from "../../src/talend/log-viewer";

const SAMPLE_LOG = `
2025-06-02 10:00:00,123 [main] INFO  - Job test_job started
2025-06-02 10:00:01,456 [main] INFO  - tRowGenerator_1 start
2025-06-02 10:00:02,789 [main] ERROR - test_job: Unknown column 'foo' in 'where clause'
2025-06-02 10:00:03,012 [main] ERROR - test_job: Exception in component tMysqlOutput_1
2025-06-02 10:00:03,456 [main] INFO  - Job test_job finished
`.trim();

describe("log-viewer", () => {
  describe("readLogContent", () => {
    test("devuelve todas las líneas si no hay límites", () => {
      const result = readLogContent("/dev/null", {});
      expect(result.lines.length).toBeGreaterThan(0);
    });

    test("filtra líneas por texto", () => {
      const result = readLogContent("/dev/null", { filter: "ERROR" });
      expect(result.lines.every((l) => l.toLowerCase().includes("error"))).toBe(true);
    });

    test("limita líneas con maxLines", () => {
      const result = readLogContent("/dev/null", { maxLines: 5 });
      expect(result.lines.length).toBeLessThanOrEqual(5);
    });

    test("indica si está truncado", () => {
      const result = readLogContent("/dev/null", { maxLines: 1 });
      expect(typeof result.truncated).toBe("boolean");
    });
  });

  describe("analyzeJobLogs", () => {
    test("devuelve sugerencias cuando no encuentra log", () => {
      const result = analyzeJobLogs("nonexistent_job_xyz");
      expect(result.logFile).toBeNull();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("formatLogLines", () => {
    test("agrega número de línea y marcador a líneas de error", () => {
      const lines = ["INFO todo bien", "ERROR algo falló"];
      const formatted = formatLogLines(lines, true);
      expect(formatted).toContain(">>>");
      expect(formatted).toContain("INFO todo bien");
      expect(formatted).toContain("    1  ");
    });

    test("funciona sin números de línea", () => {
      const lines = ["INFO todo bien", "ERROR algo falló"];
      const formatted = formatLogLines(lines, false);
      expect(formatted).toContain("INFO todo bien");
      expect(formatted).toContain("ERROR algo falló");
      expect(formatted).toContain(">>>");
    });
  });
});