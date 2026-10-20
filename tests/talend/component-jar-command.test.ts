import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getJarCommand } from "../../src/talend/components/component-jar-scanner";

const previousJavaHome = process.env.JAVA_HOME;
let tempRoot: string | undefined;

afterEach(() => {
  if (previousJavaHome === undefined) delete process.env.JAVA_HOME;
  else process.env.JAVA_HOME = previousJavaHome;
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

describe("component jar command", () => {
  test("usa jar del JAVA_HOME cuando no está en PATH", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "talend-java-home-"));
    const binDir = join(tempRoot, "bin");
    const jarName = process.platform === "win32" ? "jar.exe" : "jar";
    const jarPath = join(binDir, jarName);
    mkdirSync(binDir, { recursive: true });
    writeFileSync(jarPath, "");
    process.env.JAVA_HOME = tempRoot;

    expect(getJarCommand()).toBe(jarPath);
  });
});
