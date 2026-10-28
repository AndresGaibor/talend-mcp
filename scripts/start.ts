import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

import { installBridge } from "./install-bridge";
import { runningBridgeVersion } from "./lib/bridge-hot-reload";
import { runBridgeStatus } from "./lib/bridge-status";
import { runBridgeWatch } from "./lib/bridge-watch";
import { detectStudio } from "./lib/studio-detect";
import { createUi } from "../src/shared/cli/ui";

const PROJECT_ROOT = join(import.meta.dir, "..");

/**
 * Arranque del servidor MCP de Talend.
 *
 *   bun run start                      -> actualiza el plugin si hace falta y levanta el MCP
 *   bun run start --install-bridge     -> compila e instala el plugin Java
 *   bun run start --bridge-status      -> estado del bridge: Studio, version en vivo, build y jar publicado
 *   bun run start --watch-bridge       -> recompila y recarga el plugin en cada cambio (Studio abierto)
 *   bun run start --skip-bridge        -> no toca el plugin (arranque minimo)
 *
 * La actualizacion automatica solo actua cuando el bridge no responde y Talend
 * Studio esta abierto: compila con javac y publica el jar para carga en
 * caliente. Nunca lanza Maven ni p2 en el arranque. Se desactiva con
 * `TALEND_BRIDGE_AUTO_INSTALL=0` o `--skip-bridge`.
 */

const IS_WIN = platform() === "win32";
const ui = createUi();

async function ensureBridge(): Promise<void> {
  const disabled = process.env.TALEND_BRIDGE_AUTO_INSTALL;
  if (disabled === "0" || disabled === "false") return;

  const version = await runningBridgeVersion();
  if (version) {
    ui.debug(`Bridge activo (version ${version}).`);
    return;
  }

  if (!detectStudio()) {
    ui.debug("Bridge sin respuesta y sin Talend Studio detectable: se arranca sin bridge.");
    return;
  }

  ui.info("Bridge sin respuesta: actualizando el plugin en Talend Studio...");
  await installBridge({ auto: true });
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
        if (t.startsWith("error:")) ui.fail(t);
        else ui.line(`  ${t}`);
      }
    }
  } catch {}
}

function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (Date.now() - start > timeoutMs) { reject(new Error("Timeout")); return; }
      fetch(url)
        .then((res) => { if (res.ok) resolve(); else setTimeout(check, 50); })
        .catch(() => setTimeout(check, 50));
    }
    check();
  });
}

function killProcess(proc: { pid?: number; kill: (signal?: any) => any } | null, signal: string | number): void {
  if (!proc) return;
  try { proc.kill(signal as any); } catch {}
}

async function startServer(): Promise<void> {
  ui.banner("Talend MCP", ["Inicio automatizado"]);
  ui.separator();
  ui.info("Iniciando servidor MCP...");

  const mcpPort = process.env.TALEND_MCP_PORT || "3927";
  // `agent` mantiene el catalogo en ~90 KB en vez de ~370 KB. Para descubrir
  // todas las capacidades: TALEND_MCP_FILTER=canonical (o all).
  const mcpFilter = process.env.TALEND_MCP_FILTER || "agent";

  if (IS_WIN) {
    const portNumber = Number(mcpPort);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      throw new Error(`TALEND_MCP_PORT no es válido: ${mcpPort}`);
    }
    const powershell = [
      `$owners = Get-NetTCPConnection -State Listen -LocalPort ${portNumber} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      "foreach ($owner in $owners) { taskkill.exe /F /T /PID $owner | Out-Null }",
      // Sin conexiones, `Get-NetTCPConnection` deja `$?` en falso y PowerShell sale con 1.
      "if (-not $owners) { exit 0 }",
    ].join("; ");
    try {
      const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", powershell], {
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || `PowerShell terminó con código ${result.status}`);
      }
    } catch (error) {
      ui.warn(`No se pudo liberar el puerto ${mcpPort}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    try {
      const lsof = spawnSync("lsof", ["-ti", `tcp:${mcpPort}`], { encoding: "utf8" });
      const pids = (lsof.stdout ?? "").trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        ui.info(`Puerto ${mcpPort} ocupado por PID ${pid}: terminando el proceso anterior...`);
        spawnSync("kill", ["-9", pid], { stdio: "ignore" });
      }
    } catch {}
  }

  ui.info(`Filtro de tools: ${mcpFilter}`);

  const mcpServer = Bun.spawn(["bun", "run", join(import.meta.dir, "..", "index.ts")], {
    env: { ...process.env, TALEND_MCP_FILTER: mcpFilter },
    stdio: ["ignore", "inherit", "pipe"],
  });

  processMcpOutput(mcpServer.stderr).catch(() => {});

  const healthUrl = `http://127.0.0.1:${mcpPort}/healthz`;
  ui.info("Esperando al servidor MCP...");
  try {
    await waitForHealth(healthUrl);
    ui.ok(`Servidor MCP listo en el puerto ${mcpPort} (${mcpFilter}).`);
  } catch {
    ui.warn("El servidor MCP no responde.");
    ui.line(`  Revisa el error de Bun de arriba y que el puerto ${mcpPort} este libre.`);
  }

  function cleanup() {
    ui.info("Cerrando servicios...");
    killProcess(mcpServer, IS_WIN ? "SIGBREAK" : "SIGTERM");
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
      ui.fail(`El servidor MCP termino inesperadamente (codigo ${code}).`);
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

  if (args.includes("--bridge-status")) {
    await runBridgeStatus(PROJECT_ROOT);
    return;
  }

  if (args.includes("--watch-bridge")) {
    process.exitCode = await runBridgeWatch(PROJECT_ROOT, detectStudio());
    return;
  }

  if (!existsSync(join(import.meta.dir, "..", "index.ts"))) {
    ui.fail("No se encontro el entrypoint index.ts del servidor MCP.");
    process.exitCode = 1;
    return;
  }

  if (!args.includes("--skip-bridge")) {
    await ensureBridge();
  }

  await startServer();
}

main().catch((error: unknown) => {
  ui.fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
