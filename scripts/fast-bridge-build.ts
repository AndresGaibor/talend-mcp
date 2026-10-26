import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Compilacion rapida del plugin Java del bridge, sin Maven.
 *
 * Maven + Tycho tarda 20-40 s por compilacion (arranque de la JVM, resolucion
 * del target platform, feature y update site). Para la carga en caliente solo
 * hace falta el jar del bundle, y ese jar es sencillo: clases, plugin.xml y el
 * MANIFEST. Aqui se compila con `javac` contra los mismos jars que Tycho ya
 * descargo en `~/.m2` y se empaqueta con `jar`: unos 8 s en total, y 0 s si
 * las fuentes no han cambiado.
 *
 * El update site de p2 (que solo se usa con Studio cerrado) sigue saliendo de
 * Maven, y tambien es el respaldo si todavia no hay jars en `~/.m2`.
 */

const IS_WIN = platform() === "win32";
const EXE = IS_WIN ? ".exe" : "";

export type FastBuild = {
  jar: string;
  /** Version completa del bundle (con calificador unico), la que devuelve /ping. */
  version: string;
  /** true si no hubo que compilar porque las fuentes no cambiaron. */
  reused: boolean;
};

export type FastBuildResult =
  | { status: "ok"; build: FastBuild }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; errors: string };

type BuildState = { fingerprint: string; version: string };

/** Jars del target platform que Tycho dejo resueltos en el repositorio local. */
/** Jars del target platform (los que Tycho dejo en ~/.m2): el classpath con el que se compila el bundle. */
export function targetPlatformJars(): string[] {
  const root = join(homedir(), ".m2", "repository", "p2", "osgi", "bundle");
  if (!existsSync(root)) return [];

  const jars: string[] = [];
  for (const id of readdirSync(root)) {
    // Los bundles `.source` traen fuentes, no clases.
    if (id.endsWith(".source")) continue;
    const versions = readdirSync(join(root, id));
    const latest = versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    if (!latest) continue;
    const dir = join(root, id, latest);
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".jar")) jars.push(join(dir, file));
    }
  }
  return jars;
}

function javaSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...javaSources(full));
    else if (entry.name.endsWith(".java")) found.push(full);
  }
  return found.sort();
}

/** Huella de lo que entra en el jar: ruta, tamano y fecha de cada fuente. */
function fingerprintOf(files: string[], jarCount: number): string {
  const hash = createHash("sha1");
  hash.update(`jars:${jarCount}\n`);
  for (const file of files) {
    const stat = statSync(file);
    hash.update(`${file}:${stat.size}:${stat.mtimeMs}\n`);
  }
  return hash.digest("hex");
}

function stamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function readState(file: string): BuildState | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as BuildState;
  } catch {
    return null;
  }
}

/**
 * javac imprime `ruta.java:12: error: mensaje`; se reescribe al formato de
 * Maven (`[ERROR] ruta.java:[12,1] mensaje`) para que se pueda filtrar igual.
 */
function formatJavacOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("Note:"))
    .map((line) => line.replace(/^(.+\.java):(\d+): (?:error|warning): (.*)$/, "[ERROR] $1:[$2,1] $3"))
    .join("\n")
    .trim();
}

/** Rutas del bundle y de la salida de la compilacion rapida. */
function bundlePaths(projectRoot: string) {
  const bundleDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge");
  const workDir = join(bundleDir, "target", "fast");
  return {
    bundleDir,
    manifestPath: join(bundleDir, "META-INF", "MANIFEST.MF"),
    pluginXml: join(bundleDir, "plugin.xml"),
    workDir,
    statePath: join(workDir, "build.json"),
    jarPath: join(workDir, "com.andres.talend.bridge.jar"),
  };
}

/** Huella de lo que entra en el jar ahora mismo: fuentes, MANIFEST, plugin.xml y jars del target platform. */
function currentFingerprint(projectRoot: string, jarCount: number): string {
  const paths = bundlePaths(projectRoot);
  const sources = javaSources(join(paths.bundleDir, "src"));
  return fingerprintOf([...sources, paths.manifestPath, paths.pluginXml], jarCount);
}

/**
 * Dice si el ultimo build rapido sigue valiendo para las fuentes actuales, sin compilar.
 * Lo usa el estado del bridge para avisar de cambios que todavia no estan publicados.
 */
export function bridgeBuildStatus(projectRoot: string): { upToDate: boolean; version?: string; jar: string } {
  const paths = bundlePaths(projectRoot);
  const jars = targetPlatformJars();
  const previous = readState(paths.statePath);
  if (!previous || jars.length === 0 || !existsSync(paths.jarPath)) {
    return { upToDate: false, jar: paths.jarPath };
  }
  const upToDate = previous.fingerprint === currentFingerprint(projectRoot, jars.length);
  return { upToDate, version: previous.version, jar: paths.jarPath };
}

export function buildBridgeFast(projectRoot: string, jdk: string, force = false): FastBuildResult {
  const { bundleDir, manifestPath, workDir, statePath, jarPath } = bundlePaths(projectRoot);
  const javac = join(jdk, "bin", `javac${EXE}`);
  const jarTool = join(jdk, "bin", `jar${EXE}`);

  if (!existsSync(javac) || !existsSync(jarTool)) {
    return { status: "unavailable", reason: "el JDK no trae javac/jar" };
  }

  const jars = targetPlatformJars();
  if (jars.length === 0) {
    return { status: "unavailable", reason: "todavia no hay jars del target platform en ~/.m2 (hace falta un build de Maven)" };
  }

  const sources = javaSources(join(bundleDir, "src"));
  const fingerprint = currentFingerprint(projectRoot, jars.length);

  const previous = readState(statePath);
  if (!force && previous && previous.fingerprint === fingerprint && existsSync(jarPath)) {
    return { status: "ok", build: { jar: jarPath, version: previous.version, reused: true } };
  }

  const classesDir = join(workDir, "classes");
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(classesDir, { recursive: true });

  const toArg = (path: string) => `"${path.replace(/\\/g, "/")}"`;
  const classpathFile = join(workDir, "classpath.txt");
  const sourcesFile = join(workDir, "sources.txt");
  writeFileSync(classpathFile, `-classpath\n${toArg(jars.join(IS_WIN ? ";" : ":"))}\n`, "utf8");
  writeFileSync(sourcesFile, sources.map(toArg).join("\n"), "utf8");

  const compile = spawnSync(javac, [
    // Arranque rapido: la compilacion es corta y no compensa el JIT completo.
    "-J-XX:TieredStopAtLevel=1",
    "-J-Xshare:auto",
    "-encoding", "UTF-8",
    "--release", "17",
    "-nowarn",
    "-proc:none",
    "-d", classesDir,
    `@${classpathFile}`,
    `@${sourcesFile}`,
  ], { encoding: "utf8" });

  if (compile.status !== 0) {
    return { status: "failed", errors: formatJavacOutput(`${compile.stdout ?? ""}\n${compile.stderr ?? ""}`) };
  }

  // El MANIFEST es el del bundle, con el calificador que Tycho pondria.
  const manifest = readFileSync(manifestPath, "utf8");
  const baseVersion = manifest.match(/^Bundle-Version:\s*(\d+\.\d+\.\d+)\.qualifier\s*$/m)?.[1];
  if (!baseVersion) {
    return { status: "failed", errors: "El MANIFEST no tiene un Bundle-Version con el formato x.y.z.qualifier." };
  }
  const version = `${baseVersion}.${stamp()}`;
  const manifestFile = join(workDir, "MANIFEST.MF");
  writeFileSync(
    manifestFile,
    `${manifest.replace(/^Bundle-Version:.*$/m, `Bundle-Version: ${version}`).replace(/\s+$/, "")}\n`,
    "utf8",
  );

  const pack = spawnSync(jarTool, [
    "-J-XX:TieredStopAtLevel=1",
    "--create",
    "--file", jarPath,
    "--manifest", manifestFile,
    "-C", classesDir, ".",
    "-C", bundleDir, "plugin.xml",
  ], { encoding: "utf8" });

  if (pack.status !== 0) {
    return { status: "failed", errors: `No se pudo empaquetar el jar:\n${pack.stderr ?? ""}` };
  }

  writeFileSync(statePath, JSON.stringify({ fingerprint, version } satisfies BuildState), "utf8");
  return { status: "ok", build: { jar: jarPath, version, reused: false } };
}
