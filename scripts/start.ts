import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

import { installBridge } from "./install-bridge";

/**
 * Arranque del servidor MCP de Talend.
 *
 *   bun run scripts/start.ts                 -> levanta el servidor HTTP local
 *   bun run scripts/start.ts --install-bridge -> compila e instala el plugin Java
 */

const IS_WIN = platform() === "win32";

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
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

function separador(): void {
  console.error(`  ${c("─".repeat(40), C.dim)}`);
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

function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (Date.now() - start > timeoutMs) { reject(new Error("Timeout")); return; }
      fetch(url).then((res) => { if (res.ok) resolve(); else setTimeout(check, 300); }).catch(() => setTimeout(check, 300));
    }
    check();
  });
}

function killProcess(proc: { pid?: number; kill: (signal?: any) => any } | null, signal: string | number): void {
  if (!proc) return;
  try { proc.kill(signal as any); } catch {}
}

async function startServer(): Promise<void> {
  console.error(`\n  ${c("Talend MCP", C.bold)} ${c("— Inicio automatizado", C.dim)}\n`);

  separador();
  info("Iniciando servidor MCP...");

  const mcpPort = process.env.TALEND_MCP_PORT || "3927";
  const mcpFilter = process.env.TALEND_MCP_FILTER || "canonical";

  if (!IS_WIN) {
    try {
      const lsof = spawnSync("lsof", ["-ti", `tcp:${mcpPort}`], { encoding: "utf8" });
      const pids = (lsof.stdout ?? "").trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        info(`Puerto ${mcpPort} ocupado por PID ${pid} — terminando proceso anterior...`);
        spawnSync("kill", ["-9", pid], { stdio: "ignore" });
      }
    } catch {}
  }

  info(`Filtro de tools: ${c(mcpFilter, C.cyan)}`);

  const mcpServer = Bun.spawn(["bun", "run", join(import.meta.dir, "..", "index.ts")], {
    env: { ...process.env, TALEND_MCP_FILTER: mcpFilter },
    stdio: ["ignore", "inherit", "pipe"],
  });

  processMcpOutput(mcpServer.stderr).catch(() => {});

  const healthUrl = `http://127.0.0.1:${mcpPort}/healthz`;
  let mcpReady = false;
  info("Esperando al servidor MCP...");
  try {
    await waitForHealth(healthUrl);
    ok(`Servidor MCP listo en puerto ${mcpPort} (${mcpFilter} tools)`);
    mcpReady = true;
  } catch {
    warn("Servidor MCP no responde");
  }

  if (!mcpReady) {
    setTimeout(() => {
      console.error();
      console.error(`  ${c("MCP server no disponible", C.yellow)}`);
      console.error(`  ${c("El servidor MCP local fallo al iniciar. Revisa el error de Bun arriba.", C.dim)}`);
      console.error(`  ${c(`• Puerto ${mcpPort} ocupado`, C.dim)}`);
      console.error();
    }, 2000);
  }

  function cleanup() {
    info("Cerrando servicios...");
    if (IS_WIN) killProcess(mcpServer, "SIGBREAK");
    else killProcess(mcpServer, "SIGTERM");
    setTimeout(() => {
      if (IS_WIN) {
        spawnSync("taskkill", ["/F", "/T", "/PID", String(mcpServer.pid)], { stdio: "pipe" });
      } else {
        killProcess(mcpServer, "SIGKILL");
      }
      process.exit(0);
    }, 3000);
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  mcpServer.exited.then((code: number | null) => {
    if (code !== null && code !== 0) {
      fail(`Servidor MCP termino inesperadamente (codigo ${code})`);
      cleanup();
    }
  });

  mcpServer.ref();
  await mcpServer.exited;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--install-bridge") || args.includes("-i")) {
    await installBridge();
    return;
  }

  if (!existsSync(join(import.meta.dir, "..", "index.ts"))) {
    fail("No se encontro el entrypoint index.ts del servidor MCP.");
    process.exitCode = 1;
    return;
  }

  await startServer();
}

main();
