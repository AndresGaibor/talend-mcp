import { describe, expect, it } from "bun:test";
import { buildLauncherArgs } from "../../src/talend/runner/exported-job-runner";
import { buildScriptExecutionArgs, detectJobRunnerStrategy } from "../../src/platform/job-runner-strategy";
import type { PlatformContext } from "../../src/platform/runtime";

const windows = { runtimeOs: "windows", talendHostOs: "windows", pathMode: "native" } as PlatformContext;
const posix = { runtimeOs: "linux", talendHostOs: "linux", pathMode: "native" } as PlatformContext;

describe("buildLauncherArgs", () => {
  it("pasa el contexto como --context= y cada parametro como --context_param clave=valor", () => {
    expect(
      buildLauncherArgs({ contextName: "Produccion", params: { ruta: "/datos/entrada.csv", lote: "5000" } }),
    ).toEqual(["--context=Produccion", "--context_param", "ruta=/datos/entrada.csv", "--context_param", "lote=5000"]);
  });

  it("sin contexto ni parametros no añade argumentos", () => {
    expect(buildLauncherArgs({})).toEqual([]);
  });
});

describe("buildScriptExecutionArgs con argumentos extra", () => {
  it("en Windows los argumentos van detras de la ruta del script", () => {
    const strategy = { ...detectJobRunnerStrategy(windows), shell: "cmd.exe" as const };
    const args = buildScriptExecutionArgs("C:\\build\\JOB\\JOB_run.bat", strategy, windows, ["--context=Default"]);
    expect(args).toEqual(["/C", "C:\\build\\JOB\\JOB_run.bat", "--context=Default"]);
  });

  it("en sh los argumentos van entrecomillados y no se expanden", () => {
    const strategy = { ...detectJobRunnerStrategy(posix), shell: "bash" as const };
    const args = buildScriptExecutionArgs("/build/JOB/JOB_run.sh", strategy, posix, ["--context_param", "frase=a 'b' $HOME"]);
    expect(args[0]).toBe("-c");
    expect(args[1]).toBe(`chmod +x "/build/JOB/JOB_run.sh" && "/build/JOB/JOB_run.sh" '--context_param' 'frase=a '\\''b'\\'' $HOME'`);
  });

  it("sin argumentos extra conserva el comportamiento anterior", () => {
    const strategy = { ...detectJobRunnerStrategy(posix), shell: "bash" as const };
    expect(buildScriptExecutionArgs("/build/JOB/JOB_run.sh", strategy, posix)).toEqual([
      "-c",
      `chmod +x "/build/JOB/JOB_run.sh" && "/build/JOB/JOB_run.sh"`,
    ]);
  });
});
