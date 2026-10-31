import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Tiempo maximo de una llamada a `jar`: si se cuelga, no puede colgar el MCP. */
export const JAR_TIMEOUT_MS = 60_000;

export function getJarCommand(): string {
  const jarName = process.platform === "win32" ? "jar.exe" : "jar";
  const javaHomeJar = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", jarName) : "";
  return javaHomeJar && existsSync(javaHomeJar) ? javaHomeJar : "jar";
}

/**
 * Ejecuta `jar` con tope de tiempo.
 *
 * `Bun.spawn` no tiene timeout: un `jar` colgado dejaba la tool esperando para
 * siempre y el proceso seguia vivo consumiendo memoria. Al pasarse se mata y se
 * falla con un mensaje que dice que paso.
 */
async function runJar(args: string[], cwd?: string): Promise<string> {
  const proc = Bun.spawn([getJarCommand(), ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), JAR_TIMEOUT_MS);
  });

  // Se leen los flujos a la vez que se espera: si no, un `jar tf` grande llena
  // la tuberia y el proceso se queda bloqueado escribiendo.
  const salida = new Response(proc.stdout).text();
  void new Response(proc.stderr).text();
  const resultado = await Promise.race([proc.exited, timeout]);
  if (timer) clearTimeout(timer);

  const out = await salida;
  if (resultado === "timeout") {
    proc.kill();
    await proc.exited;
    throw new Error(`El comando jar no respondio en ${JAR_TIMEOUT_MS} ms (${args[0] ?? ""}).`);
  }
  return out;
}

export async function listJarEntries(jarPath: string): Promise<string[]> {
  const out = await runJar(["tf", jarPath]);

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

  await runJar(["xf", jarPath, entry], targetDir);

  const extracted = join(targetDir, entry);
  return existsSync(extracted) ? extracted : null;
}
