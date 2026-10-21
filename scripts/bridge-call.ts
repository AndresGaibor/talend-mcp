/**
 * Llama directo a la API HTTP del bridge de Talend Studio, sin pasar por el MCP.
 *
 *   bun run scripts/bridge-call.ts /ping
 *   bun run scripts/bridge-call.ts /automation/components '{"filter":"tFile","limit":5}'
 *   bun run scripts/bridge-call.ts /automation/nodes/add '{"type":"tLogRow"}'
 *   bun run scripts/bridge-call.ts /automation/run-code @codigo.json
 *
 * Con cuerpo la peticion es POST; sin cuerpo, GET. El cuerpo puede ir en linea o como
 * `@archivo.json`. La respuesta sale por stdout como JSON; `--raw` la deja sin formatear.
 *
 * Config (todas opcionales): TALEND_BRIDGE_HOST (127.0.0.1), TALEND_BRIDGE_PORT (3930),
 * TALEND_BRIDGE_TOKEN (si no, se lee de ~/.talend-bridge/token) y `--timeout <ms>`.
 *
 * Las rutas disponibles estan en docs/GUIA-AGENTE.md (seccion "API directa del bridge").
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const raw = args.includes("--raw");

function valueOf(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const positional = args.filter((arg, index) => {
  if (arg === "--raw") return false;
  if (arg === "--timeout") return false;
  return args[index - 1] !== "--timeout";
});

const path = positional[0];
if (!path || !path.startsWith("/")) {
  console.error("Uso: bun run scripts/bridge-call.ts /ruta [json | @archivo.json] [--raw] [--timeout ms]");
  process.exit(1);
}

function readToken(): string {
  const fromEnv = process.env.TALEND_BRIDGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(join(homedir(), ".talend-bridge", "token"), "utf8").trim();
  } catch {
    console.error("No hay token: abre Talend Studio con el bridge o define TALEND_BRIDGE_TOKEN.");
    process.exit(1);
  }
}

let body: string | undefined = positional[1];
if (body?.startsWith("@")) {
  body = readFileSync(body.slice(1), "utf8");
}
if (body !== undefined) {
  try {
    JSON.parse(body);
  } catch (error) {
    console.error(`Cuerpo invalido: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const host = process.env.TALEND_BRIDGE_HOST ?? "127.0.0.1";
const port = process.env.TALEND_BRIDGE_PORT ?? "3930";
const timeoutMs = Number(valueOf("--timeout") ?? 120_000);

try {
  const response = await fetch(`http://${host}:${port}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${readToken()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let output = text;
  if (!raw) {
    try {
      output = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // No era JSON: se deja tal cual.
    }
  }
  console.log(output);
  if (!response.ok) {
    console.error(`HTTP ${response.status}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`No se pudo llamar al bridge en ${host}:${port}: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Comprueba que Talend Studio esta abierto y el plugin cargado (/ping).");
  process.exit(1);
}
