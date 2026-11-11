import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { FAILURES_BEFORE_RESTART, backoffMs, decideMcpAction, type HealthSample } from "./lib/supervisor-policy";

/**
 * Supervisor del servidor MCP (proceso de fondo).
 *
 *   bun run supervisor           -> mantiene vivo el MCP y escribe out/supervisor.json
 *
 * Cada 10 s mide el MCP (`/healthz`) y el bridge de Studio (`/ping`).
 * - MCP caido tres muestras seguidas, o proceso terminado: lo relanza con espera creciente.
 * - Studio y su bridge solo se observan y se anotan en el latido; no se reinicia Studio.
 * Si ya hay un MCP sano al arrancar, lo adopta y solo lo vigila.
 */

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "out");
const HEARTBEAT = join(OUT, "supervisor.json");
const LOCK = join(OUT, "supervisor.lock");
const MCP_PORT = Number(process.env.TALEND_MCP_PORT) || 3927;
const BRIDGE_PORT = Number(process.env.TALEND_BRIDGE_PORT) || 3930;
const INTERVAL_MS = 10_000;
const HEALTHY_RESET_MS = 60_000;

const log = (msg: string) => console.error(`[supervisor ${new Date().toISOString()}] ${msg}`);

async function ok(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function takeLock(): boolean {
  mkdirSync(OUT, { recursive: true });
  if (existsSync(LOCK)) {
    const other = Number(readFileSync(LOCK, "utf8"));
    if (Number.isInteger(other) && other !== process.pid && pidAlive(other)) return false;
  }
  writeFileSync(LOCK, String(process.pid));
  return true;
}

function freePort(port: number): void {
  const script = [
    `$o = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    "foreach ($p in $o) { taskkill.exe /F /T /PID $p | Out-Null }",
    "exit 0",
  ].join("; ");
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
}

function writeHeartbeat(data: Record<string, unknown>): void {
  const tmp = `${HEARTBEAT}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, HEARTBEAT);
}

async function main(): Promise<void> {
  if (!takeLock()) {
    log("Ya hay un supervisor en marcha; no se inicia otro.");
    return;
  }
  const history: HealthSample[] = [];
  // El cast evita que TypeScript estreche `child` a `null`: se reasigna dentro de una funcion.
  let child = null as ReturnType<typeof Bun.spawn> | null;
  let restarts = 0;
  let startedAt = 0;
  let nextStartAt = 0;

  const spawnMcp = () => {
    freePort(MCP_PORT);
    child = Bun.spawn(["bun", "run", join(ROOT, "index.ts")], { cwd: ROOT, stdout: "ignore", stderr: "ignore" });
    startedAt = Date.now();
    log(`MCP lanzado (pid ${child.pid}, reinicio numero ${restarts}).`);
    child.exited.then((code) => {
      log(`El MCP termino (codigo ${code}).`);
      child = null;
    });
  };

  while (true) {
    const mcpOk = await ok(`http://127.0.0.1:${MCP_PORT}/healthz`);
    const bridgeOk = await ok(`http://127.0.0.1:${BRIDGE_PORT}/ping`);
    history.push({ mcpOk, bridgeOk, at: Date.now() });
    if (history.length > 10) history.shift();

    if (mcpOk && child && Date.now() - startedAt > HEALTHY_RESET_MS) restarts = 0;

    const needsStart = !mcpOk && child === null && Date.now() >= nextStartAt;
    const needsRestart = decideMcpAction(history) === "restart-mcp" && child !== null;
    if (needsRestart && child) {
      log(`El MCP no responde desde hace ${FAILURES_BEFORE_RESTART} muestras: se reinicia.`);
      child.kill();
      child = null;
      history.length = 0;
    }
    if (needsStart || needsRestart) {
      spawnMcp();
      nextStartAt = Date.now() + backoffMs(restarts++);
    }

    writeHeartbeat({ at: new Date().toISOString(), pid: process.pid, mcpOk, bridgeOk, restarts, managedChild: child !== null });
    await Bun.sleep(INTERVAL_MS);
  }
}

main().catch((error) => {
  log(`Fallo del supervisor: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
