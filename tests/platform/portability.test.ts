import { test, expect, describe } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_PATTERNS = [
  { pattern: /\/Users\/andresgaibor/, reason: "ruta personal" },
  { pattern: /andresgaibor/, reason: "nombre de usuario personal" },
  { pattern: /\/Applications\/TalendStudio/, reason: "instalación local de Talend" },
  { pattern: /aliware-calidad/, reason: "proyecto personal" },
  { pattern: /talend-studio-bridge\/.*\/target\//, reason: "artefacto de build local" },
];

const ALLOWED_DIRS_IN_SCRIPTS = ["legacy", "docs", "tests"];

function findFiles(dir: string, extensions: string[] = [".ts"]): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

async function checkFileForPatterns(filePath: string, patterns: typeof FORBIDDEN_PATTERNS): Promise<string[]> {
  const content = await Bun.file(filePath).text();
  const offenders: string[] = [];
  for (const { pattern, reason } of patterns) {
    if (pattern.test(content)) {
      offenders.push(`${reason} (${filePath})`);
    }
  }
  return offenders;
}

describe("no hardcoded local paths in src", () => {
  test("src no contiene rutas personales ni nombres de proyecto", async () => {
    const srcDir = new URL("../../src", import.meta.url).pathname;
    const files = findFiles(srcDir, [".ts"]);
    const allOffenders: string[] = [];
    for (const file of files) {
      allOffenders.push(...await checkFileForPatterns(file, FORBIDDEN_PATTERNS));
    }
    expect(allOffenders).toEqual([]);
  });

  test("scripts no contiene rutas personales excepto en directorios permitidos", async () => {
    const scriptsDir = new URL("../../scripts", import.meta.url).pathname;
    const files = findFiles(scriptsDir, [".ts"]);
    const allOffenders: string[] = [];
    for (const file of files) {
      const relPath = file.replace(scriptsDir + "/", "");
      const isInAllowedDir = ALLOWED_DIRS_IN_SCRIPTS.some((d) => relPath.startsWith(d + "/"));
      if (!isInAllowedDir) {
        const content = await Bun.file(file).text();
        if (/\/Users\/andresgaibor/.test(content) || /aliware-calidad/.test(content) || /\/Applications\/TalendStudio/.test(content)) {
          allOffenders.push(`script violador: ${relPath}`);
        }
      }
    }
    expect(allOffenders).toEqual([]);
  });
});