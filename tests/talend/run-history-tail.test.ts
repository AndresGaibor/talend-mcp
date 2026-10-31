import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveRun, tailRunOutput } from "../../src/talend/runner/run-history";

/**
 * `tailRunOutput` leia el log entero para devolver 50 lineas: un job verboso
 * metia cientos de MB en memoria del MCP. Ahora se lee solo la cola.
 */
describe("cola del historial de ejecuciones", () => {
  const dir = mkdtempSync(join(tmpdir(), "talend-runs-tail-"));
  const anteriorRunsDir = process.env.TALEND_MCP_RUNS_DIR;

  beforeAll(() => {
    process.env.TALEND_MCP_RUNS_DIR = dir;
  });

  afterAll(() => {
    if (anteriorRunsDir === undefined) delete process.env.TALEND_MCP_RUNS_DIR;
    else process.env.TALEND_MCP_RUNS_DIR = anteriorRunsDir;
    rmSync(dir, { recursive: true, force: true });
  });

  async function guardarRun(runId: string, stdout: string): Promise<void> {
    const stdoutPath = join(dir, `${runId}.stdout.log`);
    const stderrPath = join(dir, `${runId}.stderr.log`);
    writeFileSync(stdoutPath, stdout);
    writeFileSync(stderrPath, "");
    await saveRun({
      runId,
      jobName: "job_de_prueba",
      scriptPath: "/fake/path.sh",
      startedAt: new Date(2026, 3, 1).toISOString(),
      finishedAt: new Date(2026, 3, 1).toISOString(),
      status: "success",
      exitCode: 0,
      durationMs: 10,
      stdoutPath,
      stderrPath,
    });
  }

  test("un log pequeño se devuelve completo", async () => {
    await guardarRun("run_corto", "uno\ndos\ntres\n");

    const salida = await tailRunOutput({ runId: "run_corto", stream: "stdout", maxLines: 10 });

    expect(salida.stdout).toBe("uno\ndos\ntres\n");
  });

  test("un log grande devuelve sus ultimas lineas completas", async () => {
    const linea = (i: number) => `linea ${i} ${"x".repeat(40)}`;
    const total = 20_000;
    await guardarRun("run_largo", Array.from({ length: total }, (_, i) => linea(i)).join("\n") + "\n");

    // maxLines cuenta tambien la linea vacia que deja el salto final del log.
    const salida = await tailRunOutput({ runId: "run_largo", stream: "stdout", maxLines: 4 });
    const lineas = (salida.stdout ?? "").split("\n").filter((linea) => linea.length > 0);

    expect(lineas).toEqual([linea(total - 3), linea(total - 2), linea(total - 1)]);
  });
});
