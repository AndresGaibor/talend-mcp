import { describe, expect, test } from "bun:test";
import { compileWithDependencies } from "../../src/talend/studio/compile-with-dependencies";
import type { TalendStudioBridgeClient } from "../../src/talend/studio/bridge-client";

type CompileReply = { ok: boolean; data?: Record<string, unknown> };
type InstallReply = { ok: boolean; error?: { code: string; message: string } };

/**
 * Bridge falso. `compiles` son las respuestas de cada llamada a jobCompile, en
 * orden; `installs` las de installArtifact. Se registran las llamadas.
 */
function fakeBridge(compiles: CompileReply[], installs: InstallReply[] = []) {
  const compileCalls: unknown[] = [];
  const installCalls: Array<{ groupId: string; artifactId: string; version: string }> = [];
  const bridge = {
    jobCompile: async (options: unknown) => {
      compileCalls.push(options);
      const reply = compiles[compileCalls.length - 1] ?? compiles[compiles.length - 1]!;
      return { ...reply, source: "studio-bridge", confidence: "high", endpoint: "/automation/job/compile" };
    },
    installArtifact: async (options: { groupId: string; artifactId: string; version: string }) => {
      installCalls.push(options);
      const reply = installs[installCalls.length - 1] ?? { ok: true };
      return { ...reply, source: "studio-bridge", confidence: "high", endpoint: "/automation/artifacts/install" };
    },
  } as unknown as TalendStudioBridgeClient;
  return { bridge, compileCalls, installCalls };
}

const missingJsonPath: CompileReply = {
  ok: true,
  data: { compiles: false, error: { message: "Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0" } },
};
const compiled: CompileReply = { ok: true, data: { compiles: true } };

describe("compileWithDependencies", () => {
  test("un job que compila no toca dependencias", async () => {
    const { bridge, compileCalls, installCalls } = fakeBridge([compiled]);
    const outcome = await compileWithDependencies(bridge, "MCP_X", true);
    expect(compileCalls).toHaveLength(1);
    expect(installCalls).toHaveLength(0);
    expect(outcome.missingArtifacts).toEqual([]);
    expect(outcome.hint).toBeUndefined();
  });

  test("sin installMissing solo lista lo que falta y como instalarlo", async () => {
    const { bridge, compileCalls, installCalls } = fakeBridge([missingJsonPath]);
    const outcome = await compileWithDependencies(bridge, "MCP_X", false);
    expect(installCalls).toHaveLength(0);
    expect(compileCalls).toHaveLength(1);
    expect(outcome.missingArtifacts.map((item) => item.coordinate)).toEqual(["com.jayway.jsonpath:json-path:2.9.0"]);
    expect(outcome.hint).toContain("installMissing:true");
  });

  test("con installMissing descarga la dependencia y vuelve a compilar", async () => {
    const { bridge, compileCalls, installCalls } = fakeBridge([missingJsonPath, compiled]);
    const outcome = await compileWithDependencies(bridge, "MCP_X", true);
    expect(installCalls).toEqual([{ groupId: "com.jayway.jsonpath", artifactId: "json-path", version: "2.9.0" }]);
    expect(compileCalls).toHaveLength(2);
    expect(outcome.ok).toBe(true);
    expect(outcome.autoInstalled).toEqual([{ coordinate: "com.jayway.jsonpath:json-path:2.9.0", ok: true, message: undefined }]);
    expect(outcome.missingArtifacts).toEqual([]);
  });

  test("si la descarga falla no se vuelve a compilar y se dice por que", async () => {
    const { bridge, compileCalls } = fakeBridge(
      [missingJsonPath],
      [{ ok: false, error: { code: "DOWNLOAD_FAILED", message: "Maven Central no responde" } }],
    );
    const outcome = await compileWithDependencies(bridge, "MCP_X", true);
    expect(compileCalls).toHaveLength(1);
    expect(outcome.autoInstalled).toEqual([
      { coordinate: "com.jayway.jsonpath:json-path:2.9.0", ok: false, message: "Maven Central no responde" },
    ]);
  });

  test("un jar sin groupId no se intenta descargar: se pide buscar la coordenada", async () => {
    const jarOnly: CompileReply = {
      ok: true,
      data: { compiles: false, error: { message: "...json-path-2.9.0.jar inexistente" } },
    };
    const { bridge, installCalls } = fakeBridge([jarOnly]);
    const outcome = await compileWithDependencies(bridge, "MCP_X", true);
    expect(installCalls).toHaveLength(0);
    expect(outcome.missingArtifacts).toEqual([{ groupId: null, artifactId: "json-path", version: "2.9.0", coordinate: null }]);
    expect(outcome.hint).toContain("talend_studio_install_artifact");
  });
});
