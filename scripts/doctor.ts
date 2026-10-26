import { join } from "node:path";
import { homedir } from "node:os";

import { createUi } from "../src/shared/cli/ui";
import { detectStudio, runJavaVersion } from "./lib/studio-detect";
import { readTalendStudioBridgeConfig } from "../src/modules/studio-bridge/adapters/bridge-config";

/**
 * Diagnostico rapido del entorno.
 *
 *   bun run doctor
 *
 * No compila, no instala y no ejecuta jobs: solo lee archivos y hace dos
 * peticiones locales (bridge y MCP). Sirve para saber en una pantalla que
 * falta cuando una tool no responde. Sale con codigo 1 si hay un error.
 */

const ui = createUi();
const BRIDGE_URL = "http://127.0.0.1:3930/ping";

type Status = "ok" | "warn" | "fail";

const results: Array<{ status: Status; label: string; detail: string }> = [];

function report(status: Status, label: string, detail = ""): void {
  results.push({ status, label, detail });
  if (status === "ok") ui.ok(`${label}${detail ? `: ${detail}` : ""}`);
  else if (status === "warn") ui.warn(`${label}${detail ? `: ${detail}` : ""}`);
  else ui.fail(`${label}${detail ? `: ${detail}` : ""}`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await Bun.file(path).exists();
  } catch {
    return false;
  }
}

async function bridgeStatus(): Promise<string | null> {
  try {
    const response = await fetch(BRIDGE_URL, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { plugin?: string; version?: string };
    return payload.plugin === "com.andres.talend.bridge" ? (payload.version ?? "desconocida") : null;
  } catch {
    return null;
  }
}

async function mcpStatus(port: number): Promise<{ tools: number } | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { toolCount?: number };
    return { tools: payload.toolCount ?? 0 };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  ui.banner("Diagnostico del entorno", ["Comprueba Studio, bridge, MCP y configuracion."]);

  report("ok", "Bun", Bun.version);
  report("ok", "Sistema", `${process.platform} ${process.arch}`);

  // ── Talend Studio ─────────────────────────────────────────────────────────
  const studio = detectStudio();
  if (studio) {
    report("ok", "Talend Studio", studio.studioDir);
    const java = runJavaVersion(studio.jdk);
    report(java ? "ok" : "warn", "JDK", `${studio.jdk}${java ? ` (Java ${java})` : ""}`);
  } else {
    report(
      "warn",
      "Talend Studio",
      "no detectado; define TALEND_STUDIO_HOME si esta instalado",
    );
  }

  // ── Bridge ────────────────────────────────────────────────────────────────
  const version = await bridgeStatus();
  if (version) report("ok", "Bridge", `activo, version ${version}`);
  else report("warn", "Bridge", `sin respuesta en ${BRIDGE_URL}`);

  const bridgeHome = join(homedir(), ".talend-bridge");
  report(
    (await fileExists(join(bridgeHome, "token"))) ? "ok" : "warn",
    "Token del bridge",
    join(bridgeHome, "token"),
  );

  const config = await readTalendStudioBridgeConfig();
  report(
    config.readOnly ? "warn" : "ok",
    "Modo del bridge",
    config.readOnly ? "solo lectura (configura readOnly=false para escribir)" : "escritura habilitada",
  );

  const hotJar = join(process.env.TALEND_BRIDGE_HOT_DIR ?? join(bridgeHome, "hot"), "bridge.jar");
  report(
    (await fileExists(hotJar)) ? "ok" : "warn",
    "Jar de carga en caliente",
    (await fileExists(hotJar)) ? hotJar : "no publicado; ejecuta bun run start --install-bridge",
  );

  // ── Servidor MCP ──────────────────────────────────────────────────────────
  const port = Number(process.env.TALEND_MCP_PORT) || 3927;
  const mcp = await mcpStatus(port);
  if (mcp) report("ok", "Servidor MCP", `puerto ${port}, ${mcp.tools} tools`);
  else report("warn", "Servidor MCP", `sin respuesta en el puerto ${port}`);

  // ── Proyecto ──────────────────────────────────────────────────────────────
  report(
    process.env.TALEND_PROJECT ? "ok" : "warn",
    "Proyecto",
    process.env.TALEND_PROJECT ?? "TALEND_PROJECT sin definir; se infiere del workspace en cada llamada",
  );
  report(
    process.env.TALEND_WORKSPACE ? "ok" : "warn",
    "Workspace",
    process.env.TALEND_WORKSPACE ?? "TALEND_WORKSPACE sin definir",
  );
  report("ok", "Filtro de tools", process.env.TALEND_MCP_FILTER ?? "agent (por defecto)");

  // ── Resumen ───────────────────────────────────────────────────────────────
  const errors = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  ui.separator();
  if (errors > 0) {
    ui.fail(`Diagnostico: ${errors} error(es), ${warnings} aviso(s).`);
    process.exitCode = 1;
  } else if (warnings > 0) {
    ui.warn(`Diagnostico: ${warnings} aviso(s), sin errores.`);
  } else {
    ui.ok("Diagnostico: todo en orden.");
  }
}

main().catch((error: unknown) => {
  ui.fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
