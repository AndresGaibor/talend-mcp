import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveWorkspaceFromProject } from "../../workspace";

/** Patrones que documentan que se observa del proyecto (referencia). */
export const WATCH_PATTERNS = [
  "process/**/*.item",
  "process/**/*.properties",
  "context/**/*.item",
  ".metadata/.log",
  ".metadata/.plugins/org.eclipse.e4.workbench/*.xmi",
  ".metadata/.plugins/org.eclipse.debug.core/.launches/*.launch",
];

/**
 * Rutas del proyecto y del workspace que existen y se pueden observar.
 *
 * Solo se devuelven las que existen: `fs.watch` falla si la ruta no esta.
 */
export async function getPathsToWatch(projectPath: string): Promise<string[]> {
  const ws = resolveWorkspaceFromProject(projectPath);
  const paths: string[] = [];

  const candidates = [
    join(projectPath, "process"),
    join(projectPath, "context"),
    join(ws.metadataPath, ".plugins", "org.eclipse.e4.workbench"),
    join(ws.metadataPath, ".plugins", "org.eclipse.debug.core", ".launches"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) paths.push(p);
  }

  const logPath = join(ws.metadataPath, ".log");
  if (existsSync(logPath)) {
    paths.push(ws.metadataPath);
  }

  return paths;
}
