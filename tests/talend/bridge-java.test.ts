import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { buildBridgeFast, targetPlatformJars } from "../../scripts/fast-bridge-build";
import { detectStudio } from "../../scripts/lib/studio-detect";

/**
 * Tests Java del plugin: compila test/ contra el bundle y los jars de Talend Studio,
 * y los ejecuta con el JDK de Studio. Son los mismos que se hacen a mano al cambiar el
 * bridge (validacion del jar, rutas, caches...). Se saltan si no hay Studio instalado.
 */

const ROOT = join(import.meta.dir, "..", "..");
const BUNDLE = join(ROOT, "talend-studio-bridge", "com.andres.talend.bridge");
const SOURCE = join(BUNDLE, "src");
const TESTS = join(BUNDLE, "test");

function javaFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...javaFiles(path));
    else if (entry.name.endsWith(".java")) found.push(path);
  }
  return found;
}

/** Escribe argumentos en un archivo (@argfile) con barras normales, para no pasar del limite de la linea de comandos. */
function argFile(dir: string, name: string, args: string[]): string {
  const path = join(dir, name);
  writeFileSync(path, args.map((arg) => `"${arg.replace(/\\/g, "/")}"`).join("\n"), "utf8");
  return `@${path.replace(/\\/g, "/")}`;
}

const studio = detectStudio();

describe.skipIf(!studio)("tests Java del bridge", () => {
  test("los tests de la validacion, rutas, configuracion y utilidades pasan", () => {
    const build = buildBridgeFast(ROOT, studio!.jdk, false);
    expect(build.status).toBe("ok");

    const classes = join(BUNDLE, "target", "fast", "classes");
    const classpath = [classes, ...targetPlatformJars()].join(delimiter);
    const workDir = mkdtempSync(join(tmpdir(), "bridge-java-tests-"));
    try {
      const out = join(workDir, "out");
      mkdirSync(out, { recursive: true });
      const javac = join(studio!.jdk, "bin", process.platform === "win32" ? "javac.exe" : "javac");
      const compile = spawnSync(javac, [
        argFile(workDir, "javac.args", [
          "-encoding", "UTF-8",
          "-nowarn",
          "-d", out,
          "-cp", classpath,
          ...javaFiles(TESTS),
        ]),
      ], { encoding: "utf8" });
      if (compile.status !== 0) throw new Error(`javac fallo:\n${compile.stdout}\n${compile.stderr}`);

      const java = join(studio!.jdk, "bin", process.platform === "win32" ? "java.exe" : "java");
      const home = join(workDir, "home");
      mkdirSync(home, { recursive: true });
      const run = spawnSync(java, [
        argFile(workDir, "java.args", [
          `-Duser.home=${home}`,
          `-Dbridge.src=${SOURCE}`,
          "-cp", [out, classpath].join(delimiter),
          "com.andres.talend.bridge.AllTests",
        ]),
      ], { encoding: "utf8", timeout: 120_000 });

      const output = `${run.stdout}\n${run.stderr}`;
      const failures = output.split("\n").filter((line) => line.startsWith("FAIL "));
      expect(failures).toEqual([]);
      expect(output).toMatch(/RESULT passed=\d+ failed=0/);
      expect(run.status).toBe(0);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }, 240_000);
});
