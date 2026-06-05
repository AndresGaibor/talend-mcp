import { spawn, spawnSync, execSync } from "node:child_process";
import { existsSync, chmodSync, appendFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform, arch } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "url";

const IS_WIN = platform() === "win32";

const BIN_DIR = join(homedir(), ".talend-mcp", "bin");
const BIN_NAME = IS_WIN ? "tunnel-client.exe" : "tunnel-client";
const BIN_PATH = join(BIN_DIR, BIN_NAME);
const ENV_FILE = join(import.meta.dir, "..", ".env.local");
const TUNNEL_CONFIG = IS_WIN
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "tunnel-client")
  : join(homedir(), ".config", "tunnel-client");
const TUNNEL_PROFILE = join(TUNNEL_CONFIG, "talend.yaml");

const CONTROL_PLANE_API_KEY_VAR = "CONTROL_PLANE_API_KEY_VAR";

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

function formatTunnelLine(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  let entry: Record<string, unknown>;
  try { entry = JSON.parse(t); } catch { return t; }

  const level = (entry.level || "").toUpperCase();
  const msg = entry.msg || "";
  const component = entry.component || entry.module || "";

  if (level === "WARN" && entry.msg && (entry.msg as string).toLowerCase().includes("oauth")) {
    return `  ${c("○", C.dim)} ${c("OAuth discovery no aplica (modo no_auth) ✓", C.dim)}`;
  }

  const levelColor = level === "ERROR" ? C.red : level === "WARN" ? C.yellow : C.reset;
  const badge = level === "ERROR" ? "✖" : level === "WARN" ? "⚠" : "▸";

  const extraParts: string[] = [];

  if (component) extraParts.push(component);
  if (entry.request_id) extraParts.push(`req:${entry.request_id}`);
  if (entry.rpc_request_id !== undefined) extraParts.push(`rpc:${entry.rpc_request_id}`);
  if (entry.transport) extraParts.push(entry.transport as string);
  if (entry.target) extraParts.push(entry.target as string);
  if (entry.route_mode) extraParts.push(entry.route_mode as string);
  if (entry.connectorName) extraParts.push(entry.connectorName as string);
  if (entry.tunnel_url) extraParts.push(entry.tunnel_url as string);
  if (entry.ui_url) extraParts.push(entry.ui_url as string);
  if (entry.health_url) extraParts.push(entry.health_url as string);
  if (entry.addr) extraParts.push(entry.addr as string);
  if (entry.name && entry.name !== "Talend  MCP tunnel") extraParts.push(entry.name as string);
  if (entry.function) extraParts.push(entry.function as string);
  if (entry.callee) extraParts.push(entry.callee as string);
  if (entry.error) extraParts.push(`error:${entry.error}`);
  if (entry.runtime) extraParts.push(entry.runtime as string);
  if (entry.kind === "provide") extraParts.push(`provide:${entry.constructor || entry.name || ""}`);
  if (entry.kind === "supply") extraParts.push(`supply:${entry.name || ""}`);

  if (extraParts.length > 0) {
    return `  ${c(badge, levelColor)} ${c(level, levelColor)} ${c(msg, C.bold)} ${c(extraParts.join(" · "), C.dim)}`;
  }

  return `  ${c(badge, levelColor)} ${c(level, levelColor)} ${c(msg, C.bold)}`;
}

function processTunnelOutput(stream: ReadableStream<Uint8Array> | null): void {
  if (!stream) return;
  const rl = createInterface({ input: stream as unknown as NodeJS.ReadableStream });
  rl.on("line", (line: string) => {
    const f = formatTunnelLine(line);
    if (f) console.error(f);
  });
}

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
type StudioOS = "macos" | "wsl" | "windows" | "linux" | "unknown";

function detectStudioOS(): StudioOS {
  const p = platform();
  if (p === "darwin") return "macos";
  if (p === "win32" || p === "cygwin" || p === "msys") return "windows";
  if (p === "linux") {
    try {
      if (execSync("cat /proc/version 2>/dev/null", { encoding: "utf8" }).toLowerCase().includes("microsoft")) return "wsl";
    } catch {}
    return "linux";
  }
  return "unknown";
}

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
  const result = Bun.spawnSync({
    cmd: [BIN_PATH, "init", "--sample", "sample_mcp_remote_no_auth", "--profile", "talend", "--tunnel-id", tunnelId, "--mcp-server-url", "http://127.0.0.1:3927/mcp"],
    env: { ...process.env },
    stdout: "inherit",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`tunnel-client init falló (exit ${result.exitCode}):\n${result.stderr?.toString()}`);
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

function killProcess(proc: { pid?: number; kill: (...args: unknown[]) => unknown } | null, signal: string | number): void {
  if (!proc) return;
  try { proc.kill(signal); } catch {}
}

// ─── Maven Install ───────────────────────────────────────
function isMavenInstalled(): boolean {
  try {
    execSync("mvn -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function installMaven(os: StudioOS): Promise<void> {
  info("Maven no encontrado. Instalando...");

  switch (os) {
    case "macos": {
      const brewCheck = execSync("which brew 2>/dev/null || echo 'not_found'", { encoding: "utf8" }).trim();
      if (brewCheck === "not_found") {
        info("Homebrew no encontrado. Instalando Homebrew...");
        execSync(
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          { stdio: "inherit", shell: true },
        );
      }
      info("Instalando Maven via Homebrew...");
      execSync("brew install maven", { stdio: "inherit", shell: true });
      break;
    }
    case "wsl":
    case "linux": {
      info("Instalando Maven via apt-get...");
      execSync("sudo apt-get update && sudo apt-get install -y maven", { stdio: "inherit", shell: true });
      break;
    }
    case "windows": {
      const mavenVersion = "3.9.9";
      const mavenUrl = `https://dlcdn.apache.org/maven/maven-3/${mavenVersion}/binaries/apache-maven-${mavenVersion}-bin.zip`;
      const installDir = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "maven");
      mkdirSync(installDir, { recursive: true });
      const zipPath = join(installDir, "maven.zip");

      info(`Descargando Maven ${mavenVersion}...`);
      const res = await fetch(mavenUrl);
      if (!res.ok) throw new Error(`Error descargando Maven: HTTP ${res.status}`);
      Bun.write(zipPath, await res.arrayBuffer());

      info("Extrayendo Maven...");
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${installDir}' -Force"`, { stdio: "inherit", shell: true });
      rmSync(zipPath, { force: true });

      const mvnHome = join(installDir, `apache-maven-${mavenVersion}`);

      info(`Maven instalado en: ${mvnHome}`);
      console.error();
      console.error(` ${c("IMPORTANTE:", C.yellow)} Agrega al PATH permanentemente:`);
      console.error(`  ${c(`setx PATH "${mvnHome}\\bin;%PATH%"`, C.cyan)}`);

      process.env.PATH = `${mvnHome}/bin;${process.env.PATH || ""}`;
      process.env.M2_HOME = mvnHome;
      break;
    }
    default:
      throw new Error(`No se puede instalar Maven en: ${os}`);
  }

  ok("Maven instalado correctamente.");
}

async function ensureMaven(os: StudioOS): Promise<void> {
  if (isMavenInstalled()) {
    ok("Maven instalado");
    return;
  }
  await installMaven(os);
}

// ─── Bridge Install ───────────────────────────────────────
function findTalendStudio(os: StudioOS): string | null {
  const paths: Record<StudioOS, string[]> = {
    macos: [
      "/Applications/TalendStudio-8.0.1/studio",
      "/Applications/Talend Studio/studio",
    ],
    wsl: [
      "/mnt/c/Program Files/Talend Studio",
      "/mnt/c/Program Files (x86)/Talend Studio",
    ],
    windows: [
      `${process.env.PROGRAMFILES || "C:/Program Files"}/Talend Studio`,
      `${process.env["PROGRAMFILES(X86)"] || "C:/Program Files (x86)"}/Talend Studio`,
    ],
    linux: [
      "/opt/Talend Studio",
    ],
    unknown: [],
  };

  for (const p of paths[os]) {
    if (existsSync(p)) return p;
  }
  return null;
}

function getStudioExe(os: StudioOS, studioDir: string): string {
  const exePaths: Record<StudioOS, string> = {
    macos: join(studioDir, "Talend-Studio-macosx-cocoa-aarch64.app/Contents/MacOS/Talend-Studio-macosx-cocoa"),
    wsl: join(studioDir, "Talend-Studio.app/Contents/MacOS/Talend-Studio"),
    windows: join(studioDir, "Talend-Studio.app/Contents/MacOS/Talend-Studio"),
    linux: join(studioDir, "Talend-Studio"),
    unknown: "",
  };
  return exePaths[os];
}

function wslToWindowsPath(path: string): string {
  try {
    return execSync(`wslpath -w "${path}"`, { encoding: "utf8" }).trim();
  } catch {
    return path;
  }
}

function isStudioRunning(): boolean {
  try {
    const out = execSync("pgrep -fl Talend-Studio 2>/dev/null || echo ''", { encoding: "utf8" });
    return out.includes("Talend-Studio");
  } catch {
    return false;
  }
}

function killStudio(): void {
  try {
    execSync("pkill -f Talend-Studio 2>/dev/null || true");
    execSync("sleep 2");
  } catch {}
}

function cleanOldPlugins(): void {
  const pluginsDir = "/Applications/TalendStudio-8.0.1/studio/plugins";
  if (!existsSync(pluginsDir)) return;

  const files = readdirSync(pluginsDir).filter(f => f.startsWith("com.andres.talend.bridge") && f.endsWith(".jar"));
  if (files.length <= 1) return;

  const sorted = files
    .map(f => ({ name: f, time: statSync(join(pluginsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  for (const f of sorted.slice(1)) {
    const fullPath = join(pluginsDir, f.name);
    rmSync(fullPath, { force: true });
    console.log(`      Removed: ${f.name}`);
  }
}

async function installBridge(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..", "..");
  const bridgeDir = join(projectRoot, "talend-studio-bridge");

  console.error();
  console.error(`  ${c("═".repeat(50), C.magenta)}`);
  console.error(`  ${c("Bridge Install", C.bold)}`);
  console.error(`  ${c("═".repeat(50), C.magenta)}`);
  console.error();

  const os = detectStudioOS();
  info(`Sistema detectado: ${os}`);

  if (os === "unknown") {
    fail("Sistema operativo no soportado.");
    return;
  }

  const studioDir = findTalendStudio(os);
  if (!studioDir) {
    fail("No se encontró Talend Studio.");
    console.error();
    console.error("Rutas esperadas:");
    if (os === "macos") console.error("  - /Applications/TalendStudio-8.0.1/studio");
    if (os === "wsl") console.error("  - /mnt/c/Program Files/Talend Studio");
    if (os === "windows") console.error("  - %PROGRAMFILES%/Talend Studio");
    if (os === "linux") console.error("  - /opt/Talend Studio");
    return;
  }

  info(`Talend Studio encontrado: ${studioDir}`);

  const studioExe = getStudioExe(os, studioDir);
  if (!existsSync(studioExe)) {
    fail(`No se encontró ejecutable: ${studioExe}`);
    return;
  }

  const repoDir = join(bridgeDir, "com.andres.talend.bridge.repository/target/repository");

  // Ensure Maven is installed
  await ensureMaven(os);

  // Build Maven
  console.error();
  info("[1/4] Compilando proyecto Maven (Tycho)...");
  try {
    execSync("mvn clean verify -DskipTests -q", { cwd: bridgeDir, stdio: "inherit" });
    ok("Build completado");
  } catch (e) {
    fail(`Build Maven falló: ${e}`);
    return;
  }

  // Verificar update site
  console.error();
  info("[2/4] Verificando update site...");
  if (!existsSync(repoDir)) {
    fail(`No se encontró update site en ${repoDir}`);
    return;
  }
  ok("Update site encontrado");

  // Verificar Talend Studio
  console.error();
  info("[3/4] Verificando Talend Studio...");
  if (isStudioRunning()) {
    warn("Talend Studio está corriendo.");
    const answer = await prompt("¿Cerrar Talend Studio ahora? (s/n): ");
    if (answer.toLowerCase() === "s") {
      info("Cerrando Talend Studio...");
      killStudio();
      ok("Talend Studio cerrado");
    } else {
      fail("No se puede instalar mientras Talend Studio está corriendo.");
      return;
    }
  } else {
    ok("Talend Studio no está corriendo");
  }

  // Limpiar plugins antiguos (solo macOS por ahora)
  if (os === "macos") {
    console.error();
    info("Limpiando versiones antiguas del plugin...");
    cleanOldPlugins();
  }

  // Instalar
  console.error();
  info("[4/4] Instalando plugin...");

  let repoPath = repoDir;
  let studioPath = studioDir;

  if (os === "wsl") {
    repoPath = wslToWindowsPath(repoPath);
    studioPath = wslToWindowsPath(studioPath);
  }

  const installResult = Bun.spawnSync({
    cmd: [
      studioExe,
      "-application", "org.eclipse.equinox.p2.director",
      "-repository", `file://${repoPath}`,
      "-installIU", "com.andres.talend.bridge.feature.feature.group",
      "-destination", studioPath,
      "-profileProperties", "org.eclipse.update.install.features=true",
      "-nosplash",
      "-console",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  if (installResult.exitCode !== 0) {
    fail(`Instalación falló (exit ${installResult.exitCode})`);
    return;
  }

  console.error();
  ok("Plugin instalado correctamente.");
  console.error();
  console.error("Abre Talend Studio para usar el bridge actualizado.");
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Bridge install mode
  if (args.includes("--install-bridge") || args.includes("-i")) {
    await installBridge();
    return;
  }

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
  const mcpFilter = process.env.TALEND_MCP_FILTER || "canonical";

  try {
    if (!IS_WIN) {
      const lsof = Bun.spawnSync({ cmd: ["lsof", "-ti", `tcp:${mcpPort}`], stdout: "pipe", stderr: "ignore" });
      const pids = lsof.stdout.toString().trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        info(`Puerto ${mcpPort} ocupado por PID ${pid} — terminando proceso anterior...`);
        Bun.spawnSync({ cmd: ["kill", "-9", pid], stdout: "ignore", stderr: "ignore" });
      }
    }
  } catch {}

  info(`Filtro de tools: ${c(mcpFilter, C.cyan)}`);
  const mcpServer = Bun.spawn(["bun", "run", join(import.meta.dir, "..", "index.ts")], {
    env: { ...process.env, TALEND_MCP_FUNNEL: "false", TALEND_MCP_FILTER: mcpFilter },
    stdio: ["ignore", "inherit", "pipe"],
  });

  processMcpOutputBg(mcpServer.stderr);

  const mcpUrl = `http://127.0.0.1:${mcpPort}/healthz`;
  let mcpReady = false;
  info("Esperando al servidor MCP...");
  try {
    await waitForHealth(mcpUrl);
    ok(`Servidor MCP listo en puerto ${mcpPort} (${mcpFilter} tools)`);
    mcpReady = true;
  } catch {
    warn("Servidor MCP no responde");
  }

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
