import { spawn, spawnSync, execSync } from "node:child_process";
import { existsSync, chmodSync, appendFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform, arch } from "node:os";
import { createInterface } from "node:readline";

const IS_WIN = platform() === "win32";

const BIN_DIR = join(homedir(), ".talend-mcp", "bin");
const BIN_NAME = IS_WIN ? "tunnel-client.exe" : "tunnel-client";
const BIN_PATH = join(BIN_DIR, BIN_NAME);
const ENV_FILE = join(import.meta.dir, "..", ".env.local");
const TUNNEL_CONFIG = IS_WIN
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "tunnel-client")
  : join(homedir(), ".config", "tunnel-client");
const TUNNEL_PROFILE = join(TUNNEL_CONFIG, "talend.yaml");

const CONTROL_PLANE_API_KEY_VAR = "CONTROL_PLANE_API_KEY";

// ─── Estética ──────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function c(valor: unknown, color: string): string {
  return `${color}${valor}${C.reset}`;
}

function log(icono: string, msg: string, color = C.reset): void {
  console.error(`${color}${icono}${C.reset} ${msg}`);
}
function ok(msg: string): void { log("✓", msg, C.green); }
function info(msg: string): void { log("•", msg, C.cyan); }
function warn(msg: string): void { log("⚠", msg, C.yellow); }
function fail(msg: string): void { log("✖", msg, C.red); }

function banner(titulo: string, lineas: string[], color = C.red): void {
  const border = "─".repeat(50);
  console.error();
  console.error(`  ${c(border, color)}`);
  console.error(`  ${c(titulo, C.bold)}`);
  console.error(`  ${c(border, color)}`);
  for (const l of lineas) console.error(`  ${l}`);
  console.error(`  ${c(border, color)}`);
  console.error();
}

function separador(): void {
  console.error(`  ${c("─".repeat(40), C.dim)}`);
}

function processTunnelOutput(stream: any): void {
  if (!stream) return;
  const rl = createInterface({ input: stream });
  rl.on("line", (line: string) => {
    const t = line.trim();
    if (!t) return;
    console.error(`  ${c("[tunnel]", C.magenta)} ${t}`);
  });
}

// ─── MCP server output filter (Bun ReadableStream) ────────
async function processMcpOutput(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith("error:")) console.error(`  ${c("✖", C.red)} ${c(t, C.red)}`);
        else console.error(`  ${c("│", C.dim)} ${t}`);
      }
    }
  } catch {}
}

function processMcpOutputBg(stream: ReadableStream<Uint8Array> | null): void {
  processMcpOutput(stream).catch(() => {});
}

// ─── OS detection ─────────────────────────────────────────
function detectOS(): { label: string; archSuffix: string } {
  const p = platform();
  const a = arch();
  if (p === "darwin") return { label: `macOS (${a === "arm64" ? "Apple Silicon" : "Intel"})`, archSuffix: "darwin-arm64" };
  if (p === "win32") return { label: "Windows", archSuffix: "windows-amd64" };
  if (p === "linux") {
    let label = "Linux";
    try {
      if (execSync("cat /proc/version 2>/dev/null", { encoding: "utf8" }).toLowerCase().includes("microsoft")) label = "WSL (Ubuntu)";
    } catch {}
    return { label, archSuffix: "linux-amd64" };
  }
  throw new Error(`SO no soportado: ${p}`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function getLatestReleaseTag(): Promise<string> {
  const res = await fetch(
    "https://api.github.com/repos/openai/tunnel-client/releases/latest",
    { headers: { "User-Agent": "talend-mcp/1.0" } },
  );
  if (!res.ok) throw new Error(`Error obteniendo versión: HTTP ${res.status}`);
  const data = await res.json() as { tag_name?: string };
  if (!data.tag_name) throw new Error("No se pudo determinar la última versión");
  return data.tag_name;
}

async function downloadTunnelClient(os: { label: string; archSuffix: string }): Promise<void> {
  info(`Descargando tunnel-client para ${os.label}...`);
  const tag = await getLatestReleaseTag();
  const zipName = `tunnel-client-${tag}-${os.archSuffix}.zip`;
  const url = `https://github.com/openai/tunnel-client/releases/download/${tag}/${zipName}`;
  info(`URL: ${url}`);
  mkdirSync(BIN_DIR, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error descargando: HTTP ${response.status} ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  const zipPath = join(BIN_DIR, zipName);
  Bun.write(zipPath, buffer);
  info("Extrayendo...");
  const tmpDir = join(BIN_DIR, "extract");
  mkdirSync(tmpDir, { recursive: true });
  if (IS_WIN) {
    const result = spawnSync("powershell", ["-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force`], { stdio: "pipe", timeout: 30_000 });
    if (result.status !== 0) throw new Error(`Error extrayendo zip: ${result.stderr?.toString() || result.error?.message}`);
  } else {
    try { execSync("which unzip", { stdio: "pipe" }); } catch { throw new Error("unzip no instalado. macOS: viene preinstalado, Debian: sudo apt install unzip"); }
    const result = spawnSync("unzip", ["-o", zipPath, "-d", tmpDir], { cwd: BIN_DIR, stdio: "pipe", timeout: 30_000 });
    if (result.status !== 0) throw new Error(`Error extrayendo: ${result.stderr?.toString() || result.error?.message}`);
  }
  const binCandidates = IS_WIN ? [join(tmpDir, "tunnel-client.exe"), join(tmpDir, BIN_NAME)] : [join(tmpDir, "tunnel-client")];
  const finalBin = binCandidates.find((p) => existsSync(p));
  if (!finalBin) throw new Error(`No se encontró ${BIN_NAME} en el zip`);
  cpSync(finalBin, BIN_PATH);
  if (!IS_WIN) chmodSync(BIN_PATH, 0o755);
  try { rmSync(tmpDir, { recursive: true, force: true }); rmSync(zipPath, { force: true }); } catch {}
  ok(`Instalado en: ${BIN_PATH}`);
}

async function ensureApiKey(): Promise<void> {
  const fromEnv = process.env[CONTROL_PLANE_API_KEY_VAR];
  if (fromEnv) { ok(`${CONTROL_PLANE_API_KEY_VAR} definida en el entorno`); return; }
  if (existsSync(ENV_FILE)) {
    const content = await Bun.file(ENV_FILE).text();
    if (content.includes(CONTROL_PLANE_API_KEY_VAR)) { ok(`${CONTROL_PLANE_API_KEY_VAR} ya está en .env.local`); return; }
  }
  const key = await prompt(`\nIngresa tu ${c(CONTROL_PLANE_API_KEY_VAR, C.yellow)} de OpenAI (sk-...): `);
  if (!key) throw new Error("CONTROL_PLANE_API_KEY es requerida");
  appendFileSync(ENV_FILE, `\n${CONTROL_PLANE_API_KEY_VAR}="${key}"\n`);
  ok(`Guardada en ${ENV_FILE}`);
  process.env[CONTROL_PLANE_API_KEY_VAR] = key;
}

async function ensureTunnelProfile(): Promise<void> {
  if (existsSync(TUNNEL_PROFILE)) { ok(`Perfil talend encontrado`); return; }
  const tunnelId = await prompt(`\nIngresa tu ${c("Tunnel ID", C.yellow)}: `);
  if (!tunnelId) throw new Error("Tunnel ID es requerido");
  info("Inicializando perfil del tunnel...");
  const result = Bun.spawnSync([BIN_PATH, "init", "--sample", "sample_mcp_remote_no_auth", "--profile", "talend", "--tunnel-id", tunnelId, "--mcp-server-url", "http://127.0.0.1:3927/mcp"], {
    env: { ...process.env }, stdio: ["inherit", "pipe", "pipe"],
  });
  if (result.exitCode !== 0) throw new Error(`tunnel-client init falló (exit ${result.exitCode}):\n${result.stderr.toString()}`);
}

function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (Date.now() - start > timeoutMs) { reject(new Error(`Timeout`)); return; }
      fetch(url).then((res) => { if (res.ok) resolve(); else setTimeout(check, 300); }).catch(() => setTimeout(check, 300));
    }
    check();
  });
}

function killProcess(proc: { pid?: number; kill: (...args: any[]) => unknown } | null, signal: string | number): void {
  if (!proc) return;
  try { proc.kill(signal); } catch {}
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.error(`\n  ${c("Talend MCP", C.bold)} ${c("— Inicio automatizado", C.dim)}\n`);

  // ── Preliminares ──────────────────────────────────────
  const os = detectOS();
  info(`Sistema: ${c(os.label, C.cyan)}`);

  if (!existsSync(BIN_PATH)) await downloadTunnelClient(os);
  else ok("tunnel-client instalado");

  info(`Verificando ${CONTROL_PLANE_API_KEY_VAR}...`);
  await ensureApiKey();
  process.env[CONTROL_PLANE_API_KEY_VAR] = process.env[CONTROL_PLANE_API_KEY_VAR]!;
  await ensureTunnelProfile();

  // ── Iniciar MCP server ────────────────────────────────
  separador();
  info("Iniciando servidor MCP...");

  const mcpPort = process.env.TALEND_MCP_PORT || 3927;
  const mcpServer = Bun.spawn(["bun", "run", join(import.meta.dir, "..", "index.ts")], {
    env: { ...process.env, TALEND_MCP_FUNNEL: "false" },
    stdio: ["ignore", "inherit", "pipe"],
  });

  // Capturar stderr del MCP server y formatearlo
  processMcpOutputBg(mcpServer.stderr);

  const mcpUrl = `http://127.0.0.1:${mcpPort}/healthz`;
  let mcpReady = false;
  info("Esperando al servidor MCP...");
  try {
    await waitForHealth(mcpUrl);
    ok("Servidor MCP listo");
    mcpReady = true;
  } catch {
    warn("Servidor MCP no responde");
  }

  // Detectar si el MCP server se cae después
  let mcpCrashed = false;
  mcpServer.ref();
  mcpServer.exited.then((code: number | null) => {
    if (code !== null && code !== 0) {
      mcpCrashed = true;
      if (mcpReady) fail(`Servidor MCP terminó inesperadamente (código ${code})`);
    }
  });

  // ── Iniciar tunnel-client ─────────────────────────────
  separador();
  info("Iniciando tunnel-client...\n");
  const tunnel = spawn(BIN_PATH, ["run", "--profile", "talend"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  processTunnelOutput(tunnel.stdout);
  processTunnelOutput(tunnel.stderr);

  // Si el MCP no estaba listo al arrancar, mostrar ayuda
  if (!mcpReady) {
    setTimeout(() => {
      banner(
        "MCP server no disponible",
        [
          `  ${c("El servidor MCP local falló al iniciar.", C.reset)}`,
          `  ${c("Esto impide que el tunnel funcione correctamente.", C.reset)}`,
          ``,
          `  ${c("Posibles causas:", C.bold)}`,
          `  ${c("• Módulos faltantes — revisa el error de Bun arriba", C.dim)}`,
          `  ${c("• Error de compilación o importación", C.dim)}`,
          `  ${c(`• Puerto ${mcpPort} ocupado`, C.dim)}`,
          ``,
          `  ${c("Para debug:", C.bold)} ${c("bun run scripts/start-with-tunnel.ts 2>&1", C.cyan)}`,
        ],
        C.yellow,
      );
    }, 2000);
  }

  // ── Cleanup ───────────────────────────────────────────
  function cleanup() {
    info("Cerrando servicios...");
    if (IS_WIN) { killProcess(tunnel, "SIGBREAK"); killProcess(mcpServer, "SIGBREAK"); }
    else { killProcess(tunnel, "SIGTERM"); killProcess(mcpServer, "SIGTERM"); }
    setTimeout(() => {
      if (IS_WIN) {
        spawnSync("taskkill", ["/F", "/T", "/PID", String(tunnel.pid)], { stdio: "pipe" });
        spawnSync("taskkill", ["/F", "/T", "/PID", String(mcpServer.pid)], { stdio: "pipe" });
      } else {
        killProcess(tunnel, "SIGKILL");
        killProcess(mcpServer, "SIGKILL");
      }
      process.exit(0);
    }, 3000);
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  tunnel.on("exit", (code) => {
    fail(`tunnel-client terminó (código ${code})`);
    cleanup();
  });
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
