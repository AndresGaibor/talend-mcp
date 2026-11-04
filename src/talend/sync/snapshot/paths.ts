import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const SNAPSHOT_DIR = ".talend-mcp-snapshots";

export function getSnapshotDir(projectPath: string): string {
  return join(projectPath, SNAPSHOT_DIR);
}

/** Carpeta `.git` del repositorio que contiene `startPath`, subiendo por los padres. */
function findGitDir(startPath: string): string | undefined {
  let current = startPath;
  const { root } = parse(current);
  for (;;) {
    const candidate = join(current, ".git");
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Sin permiso para mirar este nivel: se sigue subiendo.
    }
    if (current === root) return undefined;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * Los proyectos de Talend suelen vivir dentro de un repositorio git del equipo. Los snapshots son copias
 * locales de seguridad: sin esto salian como archivos sin versionar y un `git add .` los subia. Se anota en
 * `.git/info/exclude`, que es local y no se comparte, en lugar de tocar el `.gitignore` del equipo.
 * Es un extra: si algo falla no debe impedir crear el snapshot.
 */
function excludeFromGit(projectPath: string): void {
  try {
    const gitDir = findGitDir(projectPath);
    if (!gitDir) return;
    const entry = `${SNAPSHOT_DIR}/`;
    const excludeFile = join(gitDir, "info", "exclude");
    mkdirSync(dirname(excludeFile), { recursive: true });
    const current = existsSync(excludeFile) ? readFileSync(excludeFile, "utf8") : "";
    if (current.split(/\r?\n/).includes(entry)) return;
    const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(excludeFile, `${separator}${entry}\n`, "utf8");
  } catch {
    // Mejor un snapshot sin exclusion que ningun snapshot.
  }
}

export function ensureSnapshotDir(projectPath: string): string {
  const dir = getSnapshotDir(projectPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  excludeFromGit(projectPath);
  return dir;
}

export function generateSnapshotId(): string {
  return "snapshot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}
