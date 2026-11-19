/**
 * Genera en dist/ los binarios de cada plataforma y checksums.txt, los mismos que sube el release.
 *   bun run release:build            -> las cuatro plataformas
 *   bun run release:build linux-x64  -> solo una (para probar)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const ALL = ["windows-x64", "linux-x64", "darwin-arm64", "darwin-x64"];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const lines: string[] = [];
for (const target of targets) {
  if (!ALL.includes(target)) throw new Error(`Plataforma desconocida: ${target}. Validas: ${ALL.join(", ")}`);
  const name = `talend-mcp-${target}${target.startsWith("windows") ? ".exe" : ""}`;
  const out = join(DIST, name);
  const r = Bun.spawnSync(["bun", "build", "--compile", `--target=bun-${target}`, "src/cli/main.ts", "--outfile", out], { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) throw new Error(`Fallo compilando ${target}`);
  lines.push(`${createHash("sha256").update(readFileSync(out)).digest("hex")}  ${name}`);
}
writeFileSync(join(DIST, "checksums.txt"), `${lines.join("\n")}\n`);
console.log(`\n${lines.join("\n")}`);
