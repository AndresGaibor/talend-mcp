import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { stagingRepositoryPath } from "./paths";

/**
 * Prepara una copia del update site en una ruta estable y un area de datos
 * aislada para el director de p2.
 */
export function prepareWorkspace(repoDir: string): { repo: string; data: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "talend-bridge-install-"));
  const repo = stagingRepositoryPath();
  const data = join(root, "p2data");
  mkdirSync(data, { recursive: true });

  rmSync(repo, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  cpSync(repoDir, repo, { recursive: true });

  return {
    repo,
    data,
    cleanup: () => {
      try { rmSync(root, { recursive: true, force: true }); } catch {}
    },
  };
}
