import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { listRuns, saveRun, readRun, tailRunOutput } from "../../src/talend/runner/run-history";

describe("run-history", () => {
  describe("saveRun y readRun", () => {
    it("guarda y lee una entrada de run", async () => {
      const entry = {
        runId: "test_run_001",
        jobName: "test_job",
        scriptPath: "/fake/path.sh",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "success" as const,
        exitCode: 0,
        durationMs: 1234,
        stdoutPath: join(__dirname, "..", "..", ".talend-mcp", "runs", "test_run_001.stdout.log"),
        stderrPath: join(__dirname, "..", "..", ".talend-mcp", "runs", "test_run_001.stderr.log"),
      };

      await saveRun(entry);
      const readBack = await readRun("test_run_001");
      expect(readBack).not.toBeNull();
      expect(readBack!.jobName).toBe("test_job");
    });
  });

  describe("listRuns", () => {
    it("devuelve array de runs", async () => {
      const runs = await listRuns({ limit: 10 });
      expect(Array.isArray(runs)).toBe(true);
    });
  });
});