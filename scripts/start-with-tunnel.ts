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

function detectOS(): { label: string; archSuffix: string } {
  const p = platform();
  const a = arch();

  if (p === "darwin") {
    return {
      label: `macOS (${a === "arm64" ? "Apple Silicon" : "Intel"})`,
      archSuffix: "darwin-arm64",
    };
  }

  if (p === "win32") {
    return { label: "Windows", archSuffix: "windows-amd64" };
  }

  if (p === "linux") {
    let label = "Linux";
    try {
      const version = execSync("cat /proc/version 2>/dev/null", { encoding: "utf8" }).toLowerCase();
      if (version.includes("microsoft") || version.includes("wsl")) {
        label = "WSL (Ubuntu)";
      }
    } catch {}
    return { label, archSuffix: "linux-amd64" };
  }

  throw new Error(`Sistema operativo no soportado: ${p}`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getLatestReleaseTag(): Promise<string> {
  const res = await fetch(
    "https://api.github.com/repos/openai/tunnel-client/releases/latest",
    { headers: { "User-Agent": "talend-mcp/1.0" } },
  );
  if (!res.ok) throw new Error(`Error obteniendo última versión: HTTP ${res.status}`);
  const data = await res.json() as { tag_name?: string };
  if (!data.tag_name) throw new Error("No se pudo determinar la última versión");
  return data.tag_name;
}

async function downloadTunnelClient(os: { label: string; archSuffix: string }): Promise<void> {
  console.error(`\nObteniendo última versión de tunnel-client para ${os.label}...`);
  const tag = await getLatestReleaseTag();
  const zipName = `tunnel-client-${tag}-${os.archSuffix}.zip`;
  const url = `https://github.com/openai/tunnel-client/releases/download/${tag}/${zipName}`;

  console.error(`  Descargando: ${url}`);

  mkdirSync(BIN_DIR, { recursive: true });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error descargando tunnel-client: HTTP ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const zipPath = join(BIN_DIR, zipName);
  Bun.write(zipPath, buffer);

  console.error("  Extrayendo...");
  const tmpDir = join(BIN_DIR, "extract");
  mkdirSync(tmpDir, { recursive: true });

  if (IS_WIN) {
    const result = spawnSync("powershell", [
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force`,
    ], { stdio: "pipe", timeout: 30_000 });
    if (result.status !== 0) {
      throw new Error(`Error extrayendo zip en Windows: ${result.stderr?.toString() || result.error?.message}`);
    }
  } else {
    // Verificar que unzip existe
    try {
      execSync("which unzip", { stdio: "pipe" });
    } catch {
      throw new Error(
        "unzip no está instalado. Instálalo con:\n"
        + "  Ubuntu/Debian: sudo apt install unzip\n"
        + "  macOS: ya viene preinstalado",
      );
    }
    const result = spawnSync("unzip", ["-o", zipPath, "-d", tmpDir], {
      cwd: BIN_DIR, stdio: "pipe", timeout: 30_000,
    });
    if (result.status !== 0) {
      throw new Error(`Error extrayendo zip: ${result.stderr?.toString() || result.error?.message}`);
    }
  }

  // Buscar el binario extraído
  const binCandidates = IS_WIN
    ? [join(tmpDir, "tunnel-client.exe"), join(tmpDir, BIN_NAME)]
    : [join(tmpDir, "tunnel-client")];

  const finalBin = binCandidates.find((p) => existsSync(p));
  if (!finalBin) {
    throw new Error(`No se encontró ${BIN_NAME} dentro del zip extraído`);
  }

  cpSync(finalBin, BIN_PATH);

  if (!IS_WIN) {
    chmodSync(BIN_PATH, 0o755);
  }

  // Limpiar temporales
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(zipPath, { force: true });
  } catch {}

  console.error(`  Instalado en: ${BIN_PATH}`);
}

async function ensureApiKey(): Promise<void> {
  const fromEnv = process.env[CONTROL_PLANE_API_KEY_VAR];
  if (fromEnv) {
    console.error(`  ${CONTROL_PLANE_API_KEY_VAR} ya está definida en el entorno`);
    return;
  }

  if (existsSync(ENV_FILE)) {
    const content = await Bun.file(ENV_FILE).text();
    if (content.includes(CONTROL_PLANE_API_KEY_VAR)) {
      console.error(`  ${CONTROL_PLANE_API_KEY_VAR} ya está en .env.local`);
      return;
    }
  }

  const key = await prompt(`\nIngresa tu CONTROL_PLANE_API_KEY de OpenAI (sk-...): `);
  if (!key) {
    throw new Error("CONTROL_PLANE_API_KEY es requerida");
  }

  appendFileSync(ENV_FILE, `\n${CONTROL_PLANE_API_KEY_VAR}="${key}"\n`);
  console.error(`  Guardada en ${ENV_FILE}`);

  process.env[CONTROL_PLANE_API_KEY_VAR] = key;
}

async function ensureTunnelProfile(): Promise<void> {
  if (existsSync(TUNNEL_PROFILE)) {
    console.error(`  Perfil talend ya existe en ${TUNNEL_PROFILE}`);
    return;
  }

  const tunnelId = await prompt(`\nIngresa tu Tunnel ID (ej: tunnel_6a1f1012a92c8191931616ac46216eed): `);
  if (!tunnelId) {
    throw new Error("Tunnel ID es requerido");
  }

  console.error("\nInicializando perfil del tunnel...");
  const result = Bun.spawnSync([
    BIN_PATH,
    "init",
    "--sample", "sample_mcp_remote_no_auth",
    "--profile", "talend",
    "--tunnel-id", tunnelId,
    "--mcp-server-url", "http://127.0.0.1:3927/mcp",
  ], {
    env: { ...process.env },
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.exitCode !== 0) {
    throw new Error(`tunnel-client init falló (exit ${result.exitCode}):\n${result.stderr.toString()}`);
  }
}

function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout esperando a ${url}`));
        return;
      }

      fetch(url)
        .then((res) => {
          if (res.ok) resolve();
          else setTimeout(check, 300);
        })
        .catch(() => setTimeout(check, 300));
    }

    check();
  });
}

function killProcess(proc: { kill: (...args: any[]) => unknown } | null, signal: string | number): void {
  if (!proc) return;
  try { proc.kill(signal); } catch {}
}

async function main() {
  console.error("=== Talend MCP - Inicio automatizado ===\n");

  const os = detectOS();
  console.error(`Sistema detectado: ${os.label}`);

  if (!existsSync(BIN_PATH)) {
    await downloadTunnelClient(os);
  } else {
    console.error(`tunnel-client ya está instalado en ${BIN_PATH}`);
  }

  console.error(`\nVerificando ${CONTROL_PLANE_API_KEY_VAR}...`);
  await ensureApiKey();
  process.env[CONTROL_PLANE_API_KEY_VAR] = process.env[CONTROL_PLANE_API_KEY_VAR]!;

  console.error("\nVerificando perfil del tunnel...");
  await ensureTunnelProfile();

  console.error("\nIniciando servidor MCP...");
  const mcpServer = Bun.spawn(["bun", "run", join(import.meta.dir, "..", "index.ts")], {
    env: { ...process.env, TALEND_MCP_FUNNEL: "false" },
    stdio: ["ignore", "inherit", "inherit"],
  });

  const mcpUrl = `http://127.0.0.1:${process.env.TALEND_MCP_PORT || 3927}/healthz`;
  console.error(`Esperando a que el servidor MCP responda...`);
  try {
    await waitForHealth(mcpUrl);
    console.error("Servidor MCP listo.\n");
  } catch {
    console.error("Servidor MCP no responde, iniciando tunnel de todas formas...");
  }

  console.error("Iniciando tunnel-client...\n");
  const tunnel = spawn(BIN_PATH, ["run", "--profile", "talend"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env },
  });

  function cleanup() {
    console.error("\nCerrando servicios...");
    if (IS_WIN) {
      killProcess(tunnel, "SIGBREAK");
      killProcess(mcpServer, "SIGBREAK");
    } else {
      killProcess(tunnel, "SIGTERM");
      killProcess(mcpServer, "SIGTERM");
    }

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
    console.error(`tunnel-client terminó con código ${code}`);
    cleanup();
  });
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
