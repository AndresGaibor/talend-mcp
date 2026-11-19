import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { VERSION } from "../version";

const ASSET = "talend-bridge-p2.zip";

/** Fuente del update site: la misma version del release, o la que indique TALEND_MCP_RELEASE_URL. */
const releaseBase = (): string =>
  (process.env.TALEND_MCP_RELEASE_URL?.trim() || `https://github.com/AndresGaibor/talend-mcp/releases/download/v${VERSION}`).replace(/\/+$/, "");

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Sin checksum no se instala: el plugin se ejecuta dentro de Studio, con acceso a tus proyectos. */
export function verifyChecksum(bytes: Uint8Array, checksums: string, asset = ASSET): void {
  const line = checksums.split(/\r?\n/).find((l) => l.includes(asset));
  if (!line) throw new Error(`checksums.txt no lista ${asset}`);
  const expected = line.trim().split(/\s+/)[0]!.toLowerCase();
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`El checksum no coincide (esperado ${expected}, obtenido ${actual}). No se instala.`);
}

/** tar (bsdtar) viene en Windows 10+ y macOS y sabe leer zip; en Linux se prueba unzip. */
function extract(zip: string, dest: string): void {
  const attempts: string[][] = [["tar", "-xf", zip, "-C", dest], ["unzip", "-q", "-o", zip, "-d", dest]];
  for (const cmd of attempts) {
    if (!Bun.which(cmd[0]!)) continue;
    if (Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).exitCode === 0) return;
  }
  throw new Error("No se pudo descomprimir el update site (hace falta tar o unzip).");
}

/** El update site es la carpeta que contiene `plugins/`; el zip puede traerla en la raiz o en una subcarpeta. */
function findRepo(dir: string): string | null {
  if (readdirSync(dir).includes("plugins")) return dir;
  for (const name of readdirSync(dir)) {
    const sub = join(dir, name);
    if (statSync(sub).isDirectory() && readdirSync(sub).includes("plugins")) return sub;
  }
  return null;
}

/** `talend-mcp bridge install [--from <zip|carpeta>] [--dry-run]` */
export async function runBridgeCommand(opts: { action?: string; from?: string; dryRun: boolean }): Promise<number> {
  if (opts.action !== "install") {
    console.error("Uso: talend-mcp bridge install [--from <zip|carpeta>] [--dry-run]");
    return 2;
  }
  const work = mkdtempSync(join(tmpdir(), "talend-bridge-"));
  try {
    let repoDir: string;
    if (opts.from && statSync(resolve(opts.from)).isDirectory()) {
      repoDir = resolve(opts.from);
    } else {
      let zipPath: string;
      if (opts.from) {
        zipPath = resolve(opts.from);
      } else {
        console.log(`Descargando ${ASSET} (${releaseBase()}) ...`);
        const bytes = await download(`${releaseBase()}/${ASSET}`);
        verifyChecksum(bytes, new TextDecoder().decode(await download(`${releaseBase()}/checksums.txt`)));
        zipPath = join(work, ASSET);
        writeFileSync(zipPath, bytes);
        console.log("Checksum verificado.");
      }
      const dest = join(work, "update-site");
      mkdirSync(dest);
      extract(zipPath, dest);
      const found = findRepo(dest);
      if (!found) throw new Error("El zip no es un update site de p2 (no contiene plugins/).");
      repoDir = found;
    }
    // Import dinamico: el instalador arrastra la deteccion de Studio y solo hace falta aqui.
    const { installBridge } = await import("../../scripts/install-bridge");
    process.exitCode = 0;
    await installBridge({ repoDir, dryRun: opts.dryRun });
    return Number(process.exitCode ?? 0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
