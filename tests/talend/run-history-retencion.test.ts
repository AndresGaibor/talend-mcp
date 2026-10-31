import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listRuns, saveRun } from "../../src/talend/runner/run-history";

/**
 * `.talend-mcp/runs` crecia sin limite: cada ejecucion deja stdout, stderr y
 * log, y nada los borraba nunca.
 */
describe("retencion del historial de ejecuciones", () => {
  const dir = mkdtempSync(join(tmpdir(), "talend-runs-"));
  const anteriorRunsDir = process.env.TALEND_MCP_RUNS_DIR;
  const anteriorMaxRuns = process.env.TALEND_MCP_MAX_RUNS;

  beforeAll(() => {
    process.env.TALEND_MCP_RUNS_DIR = dir;
    process.env.TALEND_MCP_MAX_RUNS = "3";
  });

  afterAll(() => {
    if (anteriorRunsDir === undefined) delete process.env.TALEND_MCP_RUNS_DIR;
    else process.env.TALEND_MCP_RUNS_DIR = anteriorRunsDir;
    if (anteriorMaxRuns === undefined) delete process.env.TALEND_MCP_MAX_RUNS;
    else process.env.TALEND_MCP_MAX_RUNS = anteriorMaxRuns;
    rmSync(dir, { recursive: true, force: true });
  });

  test("conserva las ejecuciones mas recientes y borra las viejas", async () => {
    for (let i = 0; i < 5; i++) {
      const runId = `run_${i}`;
      const stdoutPath = join(dir, `${runId}.stdout.log`);
      const stderrPath = join(dir, `${runId}.stderr.log`);
      writeFileSync(stdoutPath, `salida ${i}`);
      writeFileSync(stderrPath, `error ${i}`);
      writeFileSync(join(dir, `${runId}.log`), `log ${i}`);

      await saveRun({
        runId,
        jobName: "job",
        scriptPath: "/fake/path.sh",
        startedAt: new Date(2026, 0, i + 1).toISOString(),
        finishedAt: new Date(2026, 0, i + 1).toISOString(),
        status: "success",
        exitCode: 0,
        durationMs: 10,
        stdoutPath,
        stderrPath,
      });
    }

    const runs = await listRuns();
    expect(runs.map((run) => run.runId)).toEqual(["run_4", "run_3", "run_2"]);

    // Los archivos de las ejecuciones descartadas desaparecen con la entrada.
    for (const viejo of ["run_0", "run_1"]) {
      expect(existsSync(join(dir, `${viejo}.stdout.log`))).toBe(false);
      expect(existsSync(join(dir, `${viejo}.stderr.log`))).toBe(false);
      expect(existsSync(join(dir, `${viejo}.log`))).toBe(false);
      expect(existsSync(join(dir, `${viejo}.meta.json`))).toBe(false);
    }
    for (const nuevo of ["run_2", "run_3", "run_4"]) {
      expect(existsSync(join(dir, `${nuevo}.stdout.log`))).toBe(true);
      expect(existsSync(join(dir, `${nuevo}.meta.json`))).toBe(true);
    }

    // El indice en disco tambien queda recortado, no solo la respuesta.
    const enDisco = JSON.parse(await Bun.file(join(dir, "index.json")).text()) as { runs: unknown[] };
    expect(enDisco.runs).toHaveLength(3);
    expect(readdirSync(dir).filter((name) => name.endsWith(".log"))).toHaveLength(9);
  });

  test("guardar dos veces la misma ejecucion no duplica la entrada", async () => {
    const runId = "run_repetido";
    const stdoutPath = join(dir, `${runId}.stdout.log`);
    const stderrPath = join(dir, `${runId}.stderr.log`);

    for (const status of ["running", "success"] as const) {
      await saveRun({
        runId,
        jobName: "job",
        scriptPath: "/fake/path.sh",
        startedAt: new Date(2026, 1, 1).toISOString(),
        status,
        exitCode: status === "success" ? 0 : null,
        durationMs: 5,
        stdoutPath,
        stderrPath,
      });
    }

    const runs = await listRuns({ jobName: "job" });
    expect(runs.filter((run) => run.runId === runId)).toHaveLength(1);
    expect(runs[0]?.status).toBe("success");
  });

  test("borra los restos viejos que nunca llegaron al indice", async () => {
    const viejo = join(dir, "run_huerfano.stdout.log");
    const reciente = join(dir, "run_reciente.stdout.log");
    writeFileSync(viejo, "resto viejo");
    writeFileSync(reciente, "resto reciente");

    const haceMucho = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(viejo, haceMucho, haceMucho);

    await saveRun({
      runId: "run_que_dispara_limpieza",
      jobName: "job",
      scriptPath: "/fake/path.sh",
      startedAt: new Date(2026, 2, 1).toISOString(),
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutPath: join(dir, "run_que_dispara_limpieza.stdout.log"),
      stderrPath: join(dir, "run_que_dispara_limpieza.stderr.log"),
    });

    expect(existsSync(viejo)).toBe(false);
    // Lo reciente puede ser una ejecucion en curso: no se toca.
    expect(existsSync(reciente)).toBe(true);
  });
});
