import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * La documentacion que lee un agente nuevo no puede contradecir al repo: sus enlaces
 * deben resolver, sus comandos deben existir en package.json y las rutas que cita
 * (las de los mapas) deben existir. Si algo se mueve o se renombra, este test lo dice
 * antes de que un agente se pierda.
 */

const ROOT = join(import.meta.dir, "..", "..");
const PACKAGE = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };

/** Documentos que se revisan en todos sus enlaces y comandos. */
function markdownFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", "addons", "temp", "workspace"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...markdownFiles(path));
    else if (entry.endsWith(".md")) found.push(path);
  }
  return found;
}

const ALL_DOCS = [
  join(ROOT, "AGENTS.md"),
  join(ROOT, "README.md"),
  join(ROOT, "CLAUDE.md"),
  join(ROOT, "talend-studio-bridge", "README.md"),
  ...markdownFiles(join(ROOT, "docs")),
];

/** Mapas del repo: aqui se exige que cada ruta citada exista. */
const MAP_DOCS = [
  join(ROOT, "AGENTS.md"),
  join(ROOT, "README.md"),
  join(ROOT, "docs", "README.md"),
  join(ROOT, "docs", "ARQUITECTURA.md"),
  join(ROOT, "docs", "PLAN-DE-TRABAJO.md"),
  join(ROOT, "docs", "GUIA-AGENTE.md"),
];

/** Lanza un error que lista cada problema, para que quien lo lea sepa exactamente que arreglar. */
function fallaSiHay(que: string, problemas: string[]): void {
  if (problemas.length > 0) {
    throw new Error(`${problemas.length} ${que}:\n  ${problemas.join("\n  ")}`);
  }
}

/** Una ruta con placeholder (`<tema>`, `...`, `*`) describe un patron, no un archivo. */
function isPattern(path: string): boolean {
  return /[<>*{}]|\.\.\./.test(path);
}

describe("documentacion de entrada", () => {
  test("todos los enlaces markdown resuelven a un archivo o carpeta", () => {
    const broken: string[] = [];
    for (const file of ALL_DOCS) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1]!;
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = decodeURI(target.split("#")[0]!);
        if (!path || isPattern(path)) continue;
        if (!existsSync(resolve(dirname(file), path))) {
          broken.push(`${file.replace(ROOT, "").replace(/\\/g, "/")} -> ${target}`);
        }
      }
    }
    fallaSiHay("enlaces rotos", broken);
  });

  test("cada `bun run <nombre>` citado existe en package.json", () => {
    const missing: string[] = [];
    for (const file of ALL_DOCS) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/bun run ([a-zA-Z0-9:_./-]+)/g)) {
        const command = match[1]!.replace(/[.,;:]$/, "");
        if (command.includes("/")) {
          if (!existsSync(join(ROOT, command))) missing.push(`${file.replace(ROOT, "")} -> ${command}`);
        } else if (!(command in PACKAGE.scripts)) {
          missing.push(`${file.replace(ROOT, "")} -> bun run ${command}`);
        }
      }
    }
    fallaSiHay("referencias que no existen", missing);
  });

  test("las rutas que citan los mapas existen en el repo", () => {
    const missing: string[] = [];
    for (const file of MAP_DOCS) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/`((?:src|scripts|tests|docs|talend-studio-bridge)\/[^`\s]+)`/g)) {
        const path = match[1]!.replace(/[.,;:)]+$/, "");
        if (isPattern(path)) continue;
        if (!existsSync(join(ROOT, path))) missing.push(`${file.replace(ROOT, "")} -> ${path}`);
      }
    }
    fallaSiHay("referencias que no existen", missing);
  });
});
