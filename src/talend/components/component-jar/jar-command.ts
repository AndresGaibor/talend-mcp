import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function getJarCommand(): string {
  const jarName = process.platform === "win32" ? "jar.exe" : "jar";
  const javaHomeJar = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", jarName) : "";
  return javaHomeJar && existsSync(javaHomeJar) ? javaHomeJar : "jar";
}

export async function listJarEntries(jarPath: string): Promise<string[]> {
  const proc = Bun.spawn([getJarCommand(), "tf", jarPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const out = await new Response(proc.stdout).text();
  await proc.exited;

  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function extractJarEntry(
  jarPath: string,
  entry: string,
  targetDir: string
): Promise<string | null> {
  mkdirSync(targetDir, { recursive: true });

  const proc = Bun.spawn([getJarCommand(), "xf", jarPath, entry], {
    cwd: targetDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  const extracted = join(targetDir, entry);
  return existsSync(extracted) ? extracted : null;
}
