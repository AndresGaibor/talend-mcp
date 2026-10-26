import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { INITIAL_ERRORS } from "./catalog";
import type { ErrorKnowledgeBase } from "./types";

/** Persistencia de la base de conocimiento en `.talend-mcp/`. */

const ERRORS_DIR = ".talend-mcp";
const ERRORS_FILE = "error-knowledge-base.json";

function ensureErrorsDir(): string {
  const dir = join(process.cwd(), ERRORS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Base por defecto: catalogo inicial sin ocurrencias registradas. */
function defaultKnowledgeBase(): ErrorKnowledgeBase {
  return { version: 1, generatedAt: Date.now(), errors: [...INITIAL_ERRORS] };
}

function loadKnowledgeBase(): ErrorKnowledgeBase {
  const path = join(ensureErrorsDir(), ERRORS_FILE);
  if (!existsSync(path)) {
    return defaultKnowledgeBase();
  }
  try {
    const content = readFileSync(path, "utf8");
    return JSON.parse(content) as ErrorKnowledgeBase;
  } catch {
    return defaultKnowledgeBase();
  }
}

function saveKnowledgeBase(kb: ErrorKnowledgeBase): void {
  const path = join(ensureErrorsDir(), ERRORS_FILE);
  writeFileSync(path, JSON.stringify(kb, null, 2), "utf8");
}

export { loadKnowledgeBase, saveKnowledgeBase };

export function getKnowledgeBase(): ErrorKnowledgeBase {
  return loadKnowledgeBase();
}
