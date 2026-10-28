import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { platform } from "node:os";

/**
 * Deteccion de la instalacion de Talend Studio y de su JDK.
 *
 * Se usa desde el instalador del plugin, el doctor y el arranque del servidor.
 * `TALEND_STUDIO_HOME` tiene prioridad: apunta a la carpeta `studio` (la que
 * contiene `plugins/` y `features/`) o a la raiz de la instalacion. Sin esa
 * variable se revisan las ubicaciones habituales de cada sistema.
 */

const IS_WIN = platform() === "win32";

export type StudioInstall = {
  /** Carpeta raiz de la instalacion (la que contiene plugins/ y features/). */
  dir: string;
  /** Ejecutable de Talend Studio, usado para invocar el p2 director. */
  exe: string;
  /** JDK con el que se compila el plugin. */
  jdk: string;
  /** Carpeta studio/ dentro de la instalacion. */
  studioDir: string;
};

export function isStudioDir(dir: string): boolean {
  return existsSync(join(dir, "plugins")) && existsSync(join(dir, "features"));
}

/**
 * Rutas candidatas, de la mas explicita a la mas general. No comprueba que
 * existan: `detectStudio` filtra.
 */
export function studioHomeCandidates(
  env: Record<string, string | undefined> = process.env,
  os: string = platform(),
): string[] {
  const candidates: string[] = [];

  const explicit = env.TALEND_STUDIO_HOME?.trim();
  if (explicit) {
    candidates.push(explicit, join(explicit, "studio"));
  }

  if (os === "win32") {
    const roots = [
      env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "Talend Studio") : "",
      env.PROGRAMFILES ? join(env.PROGRAMFILES, "Talend Studio") : "",
      env["PROGRAMFILES(X86)"] ? join(env["PROGRAMFILES(X86)"], "Talend Studio") : "",
      "C:/Talend",
      "D:/Talend",
    ].filter(Boolean);

    for (const root of roots) {
      candidates.push(root);
      // Formato <raiz>/<version>/studio
      for (const entry of safeReaddir(root)) candidates.push(join(root, entry, "studio"));
    }
  } else if (os === "darwin") {
    candidates.push(
      "/Applications/Talend Studio/studio",
      "/Applications/Talend Studio 8.0.1/studio",
    );
    for (const entry of safeReaddir("/Applications")) {
      if (/Talend/i.test(entry)) candidates.push(join("/Applications", entry, "studio"));
    }
  } else {
    candidates.push(
      "/opt/Talend Studio",
      "/opt/talend-studio",
      "/usr/local/Talend Studio",
    );
    for (const root of ["/mnt/c/Talend", "/mnt/c/Program Files", "/mnt/c/Program Files (x86)"]) {
      for (const entry of safeReaddir(root)) {
        candidates.push(join(root, entry, "studio"), join(root, entry));
      }
    }
  }

  return candidates;
}

export function findStudioExecutable(studioDir: string): string | null {
  if (IS_WIN) {
    // En Windows el ejecutable puede estar en studio/ o en la raiz de la
    // instalacion (por ejemplo C:/Talend/8.0.1/studio/Talend-Studio-win-x86_64.exe).
    const roots = [studioDir, dirname(studioDir)];
    const candidates: string[] = [];

    for (const root of roots) {
      for (const name of safeReaddir(root)) {
        if (!name.toLowerCase().endsWith(".exe")) continue;
        if (!name.toLowerCase().startsWith("talend-studio")) continue;
        candidates.push(join(root, name));
      }
    }

    const preferred = candidates.find((p) => p.toLowerCase().includes("win")) ?? candidates[0];
    return preferred && existsSync(preferred) ? preferred : null;
  }

  const direct = join(studioDir, "Talend-Studio");
  if (existsSync(direct)) return direct;

  const macApp = join(studioDir, "Talend-Studio.app/Contents/MacOS/Talend-Studio");
  if (existsSync(macApp)) return macApp;

  const cocoa = readdirSync(studioDir)
    .filter((name) => name.startsWith("Talend-Studio") && name.endsWith(".app"))
    .map((name) => join(studioDir, name, "Contents", "MacOS",
      readdirSync(join(studioDir, name, "Contents", "MacOS")).find((n) => n.startsWith("Talend-Studio")) ?? "Talend-Studio"))
    .find((p) => existsSync(p));

  return cocoa ?? null;
}

/**
 * Busca un JDK utilizable: primero el que trae Talend Studio (siempre con la
 * version de Java que el producto exige), luego JAVA_HOME y por ultimo el PATH.
 */
export function findJdk(studioDir: string): string | null {
  const candidates: string[] = [];

  const installRoot = dirname(studioDir);
  for (const entry of safeReaddir(installRoot)) {
    if (!/jdk|jre|zulu|temurin|corretto/i.test(entry)) continue;
    const jdkDir = join(installRoot, entry);
    if (existsSync(join(jdkDir, "bin", IS_WIN ? "java.exe" : "java"))) {
      candidates.push(jdkDir);
    }
  }

  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin", IS_WIN ? "java.exe" : "java"))) {
    candidates.push(process.env.JAVA_HOME);
  }

  for (const candidate of candidates) {
    const version = runJavaVersion(candidate);
    if (version && Number(version) >= 17) return candidate;
  }

  return null;
}

export function detectStudio(
  env: Record<string, string | undefined> = process.env,
  os: string = platform(),
): StudioInstall | null {
  const seen = new Set<string>();
  for (const studioDir of studioHomeCandidates(env, os)) {
    const normalized = studioDir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (!isStudioDir(studioDir)) continue;
    const exe = findStudioExecutable(studioDir);
    if (!exe) continue;
    const jdk = findJdk(studioDir);
    if (!jdk) continue;
    return { dir: dirname(studioDir), exe, jdk, studioDir };
  }
  return null;
}

export function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const javaVersions = new Map<string, string | null>();

/** Cada `java -version` cuesta una JVM: se pregunta una sola vez por JDK. */
export function runJavaVersion(jdk: string): string | null {
  if (javaVersions.has(jdk)) return javaVersions.get(jdk) ?? null;
  const result = spawnSync(join(jdk, "bin", IS_WIN ? "java.exe" : "java"), ["-version"], { encoding: "utf8" });
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  const version = output.match(/version "(\d+)/)?.[1] ?? null;
  javaVersions.set(jdk, version);
  return version;
}
