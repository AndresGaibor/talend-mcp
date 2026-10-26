import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { homedir, platform } from "node:os";

import { buildBridgeFast } from "../fast-bridge-build";
import { createStyler, createUi, shouldUseColor } from "../../src/shared/cli/ui";
import { runJavaVersion, safeReaddir } from "./studio-detect";

/**
 * Compilacion del plugin Java.
 *
 * Con Talend Studio abierto se compila con javac (`buildBridgeFast`) y el jar
 * se publica para carga en caliente. Con Studio cerrado, o si javac no puede
 * resolver el classpath, se usa Maven + Tycho para generar el update site.
 */

const IS_WIN = platform() === "win32";
const ui = createUi();
const c = createStyler(shouldUseColor(process.env, Boolean(process.stderr.isTTY)));
const { ok, info, warn, fail, step } = ui;

function resolveMaven(): string | null {
  // MAVEN_HOME (o M2_HOME) es la forma explicita de elegir la instalacion.
  for (const home of [process.env.MAVEN_HOME, process.env.M2_HOME]) {
    if (!home) continue;
    const bin = join(home, "bin", IS_WIN ? "mvn.cmd" : "mvn");
    if (existsSync(bin)) return bin;
  }

  const which = spawnSync(IS_WIN ? "where" : "which", ["mvn"], { encoding: "utf8" });
  if (which.status === 0) {
    const first = which.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (first) return first;
  }

  const mavenRoot = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "maven");
  for (const entry of safeReaddir(mavenRoot)) {
    if (!entry.startsWith("apache-maven-")) continue;
    const bin = join(mavenRoot, entry, "bin", IS_WIN ? "mvn.cmd" : "mvn");
    if (existsSync(bin)) return bin;
  }

  return null;
}

function buildBridge(projectRoot: string, jdk: string): boolean {
  const mvn = resolveMaven();
  if (!mvn) {
    fail("No se encontro Maven. Instala Maven 3.9+, agregalo al PATH o define MAVEN_HOME.");
    return false;
  }

  const bridgeDir = join(projectRoot, "talend-studio-bridge");
  const env = { ...process.env, JAVA_HOME: jdk, PATH: [join(jdk, "bin"), process.env.PATH ?? ""].join(delimiter) };

  info(`Maven: ${c(basename(dirname(dirname(mvn))), "cyan")}`);
  info(`JDK: ${c(jdk, "cyan")} (Java ${runJavaVersion(jdk)})`);

  const result = spawnSync(mvn, ["clean", "verify", "-DskipTests", "-B"], {
    cwd: bridgeDir,
    env,
    stdio: "inherit",
    shell: IS_WIN,
  });

  return result.status === 0;
}

function builtJarPath(projectRoot: string): string | undefined {
  const targetDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge", "target");
  const jar = safeReaddir(targetDir).find((name) => name.endsWith(".jar") && !name.includes("sources"));
  return jar ? join(targetDir, jar) : undefined;
}

/** Resultado de compilar: el jar y, si se conoce, la version que traera el bundle. */
export type Compiled = { jar: string; version?: string; reused?: boolean };

export function compileWithMaven(projectRoot: string, jdk: string): Compiled | null {
  step("Compilando el plugin (Maven + Tycho)...");
  if (!buildBridge(projectRoot, jdk)) {
    fail("La compilacion fallo.");
    return null;
  }
  ok("Plugin compilado.");

  const jar = builtJarPath(projectRoot);
  if (!jar) {
    fail("No se encontro el jar compilado del bundle.");
    return null;
  }
  return { jar };
}

export function compileFast(projectRoot: string, jdk: string, force: boolean): Compiled | null | "fallback" {
  step("Compilando el plugin (javac, sin Maven)...");
  const started = Date.now();
  const result = buildBridgeFast(projectRoot, jdk, force);

  if (result.status === "unavailable") {
    warn(`Compilacion rapida no disponible: ${result.reason}. Se usa Maven.`);
    return "fallback";
  }
  if (result.status === "failed") {
    fail("La compilacion fallo.");
    ui.line(result.errors);
    return null;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.build.reused) {
    ok(`Sin cambios en las fuentes: se reutiliza el jar (${seconds} s).`);
  } else {
    ok(`Plugin compilado en ${seconds} s (version ${result.build.version}).`);
  }
  return { jar: result.build.jar, version: result.build.version, reused: result.build.reused };
}
