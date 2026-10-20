import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeJobLogs, formatLogLines, readLogContent } from "../../src/talend/log-viewer";

const SAMPLE_LOG = `
2025-06-02 10:00:00,123 [main] INFO  - Job test_job started
2025-06-02 10:00:01,456 [main] INFO  - tRowGenerator_1 start
2025-06-02 10:00:02,789 [main] ERROR - test_job: Unknown column 'foo' in 'where clause'
2025-06-02 10:00:03,012 [main] ERROR - test_job: Exception in component tMysqlOutput_1
2025-06-02 10:00:03,456 [main] INFO  - Job test_job finished
`.trim();

let tempDir: string;
let logPath: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "talend-log-"));
  logPath = join(tempDir, "test_job.log");
  writeFileSync(logPath, SAMPLE_LOG, "utf8");
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("log-viewer", () => {
  describe("readLogContent", () => {
    test("devuelve todas las líneas si no hay límites", () => {
      const result = readLogContent(logPath, {});
      expect(result.lines.length).toBe(SAMPLE_LOG.split("\n").length);
      expect(result.truncated).toBe(false);
    });

    test("filtra líneas por texto", () => {
      const result = readLogContent(logPath, { filter: "ERROR" });
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines.every((l) => l.toLowerCase().includes("error"))).toBe(true);
    });

    test("limita líneas con maxLines", () => {
      const result = readLogContent(logPath, { maxLines: 2 });
      expect(result.lines.length).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.totalLines).toBe(SAMPLE_LOG.split("\n").length);
    });

    test("indica si está truncado", () => {
      const result = readLogContent(logPath, { maxLines: 1 });
      expect(typeof result.truncated).toBe("boolean");
      expect(result.truncated).toBe(true);
    });

    test("corta desde una línea concreta con fromLine", () => {
      const result = readLogContent(logPath, { fromLine: 4 });
      expect(result.lines[0]).toContain("Exception in component tMysqlOutput_1");
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
