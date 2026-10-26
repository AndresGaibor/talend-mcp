import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const CATALOG_DIR = ".talend-mcp";
export const CATALOG_FILE = "component-catalog.json";

export function ensureCatalogDir(): string {
  const dir = join(process.cwd(), CATALOG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function catalogFilePath(): string {
  return join(process.cwd(), CATALOG_DIR, CATALOG_FILE);
}
