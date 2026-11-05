#!/usr/bin/env bun
/** CLI MVP conectado al registro local existente, sin requerir servidor HTTP. */
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { CliOperationError, describeOperation, executeOperation, listOperations } from "../application/operations/command-dispatcher";

const HELP = `Talend CLI (MVP)
Uso: talend <grupo> <comando> [argumentos] [opciones]

Comandos:
  doctor                      Diagnosticar proyecto y bridge
  jobs list                   Listar jobs sin Studio
  jobs show <nombre>          Leer componentes y conexiones
  jobs create <nombre>        Crear un job en Studio (requiere --yes)
  tools list                  Listar herramientas del registro
  tools describe <nombre>     Mostrar contrato completo
  tools call <nombre>         Ejecutar una operacion clasificada
  mcp serve                   Iniciar el servidor MCP existente

Opciones comunes:
  --project <ruta>            Ruta a un proyecto con talend.project
  --json                      Salida JSON estable para scripts
  --filter <preset>           Preset MCP usado en la CLI (canonical por defecto)
  --input <JSON|@archivo|->   Entrada a tools call; '-' lee stdin
  --limit <n>                 Limite para jobs list
  --offset <n>                Offset para jobs list
  --folder <carpeta>          Carpeta para jobs show/create
  --yes                       Autorizar escritura interactiva/preaprobada
  --port <n>                  Puerto para mcp serve
  --help                      Mostrar esta ayuda
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: { type: "string" }, json: { type: "boolean" },
    filter: { type: "string" }, input: { type: "string" },
    limit: { type: "string" }, offset: { type: "string" },
    folder: { type: "string" }, yes: { type: "boolean" },
    port: { type: "string" }, help: { type: "boolean", short: "h" },
  },
  strict: true,
  allowPositionals: true,
});

function fail(message: string, code = "ERROR"): never {
  throw new CliOperationError(message, code);
}

function intOption(name: "limit" | "offset" | "port", fallback: number): number {
  const raw = values[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < (name === "offset" ? 0 : 1)) fail(`--${name} debe ser un entero valido.`, "INVALID_INPUT");
  return value;
}

async function inputJson(): Promise<Record<string, unknown>> {
  const argument = values.input;
  if (!argument) fail("Falta --input '{...}', --input @archivo.json o --input -", "INVALID_INPUT");
  const text = argument === "-"
    ? await Bun.stdin.text()
    : argument.startsWith("@")
      ? await Bun.file(resolve(argument.slice(1))).text()
      : argument;
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return fail("La entrada no es JSON valido.", "INVALID_INPUT"); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) fail("La entrada debe ser un objeto JSON.", "INVALID_INPUT");
  return parsed as Record<string, unknown>;
}

/** Evita revelar accidentalmente secretos en doctor o JSON. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 30) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      /(token|secret|password|passphrase|authorization|api.?key|credential)/i.test(key)
        ? "[REDACTED]" : redact(entry, depth + 1),
    ]));
  }
  return value;
}

function normalize(value: unknown): unknown {
  if (value && typeof value === "object") {
    const result = value as { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> };
    if (result.structuredContent !== undefined) return result.structuredContent;
    if (Array.isArray(result.content) && result.content[0]?.type === "text") {
      const text = result.content[0].text ?? "";
      try { return JSON.parse(text); } catch { return { text }; }
    }
  }
  return value;
}

function printResult(value: unknown): void {
  const clean = redact(normalize(value));
  if (values.json) {
    console.log(JSON.stringify(clean));
    return;
  }
  console.log(JSON.stringify(clean, null, 2));
}

async function confirmWrite(action: string): Promise<boolean> {
  if (values.yes) return true;
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    fail(`${action}: anade --yes solo despues de revisar la operacion.`, "NEEDS_CONFIRMATION");
  }
  process.stderr.write(`Se modificara el proyecto Talend: ${action}\n¿Continuar? [s/N] `);
  const line = await new Promise<string>((done) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data: string) => done(data.trim()));
  });
  if (!/^(s|si|sí|y|yes)$/i.test(line)) fail("Operacion cancelada.", "CANCELLED");
  return true;
}

async function main(): Promise<void> {
  const [group, action, arg1] = positionals;
  if (values.help || !group || group === "help") { console.log(HELP); return; }

  if (values.project) {
    const project = resolve(values.project);
    if (!isAbsolute(project) || !existsSync(join(project, "talend.project"))) {
      fail(`No es un proyecto Talend valido (falta talend.project): ${project}`, "INVALID_PROJECT");
    }
    process.env.TALEND_PROJECT = project;
  }
  // El preset de CLI no hereda silenciosamente 'agent' de un proceso MCP.
  process.env.TALEND_MCP_FILTER = values.filter ?? process.env.TALEND_CLI_FILTER ?? "canonical";

  if (group === "mcp" && action === "serve") {
    const { runNewHttpServer } = await import("../presentation/server/new-server");
    const port = intOption("port", 3927);
    const server = await runNewHttpServer({ host: "127.0.0.1", port });
    process.stderr.write(`Servidor MCP: ${server.localUrl}/mcp\n`);
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await server.close();
      process.exit(0);
    };
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
    return;
  }

  if (group === "doctor") {
    printResult(await executeOperation("talend_diagnose_environment", {}));
    return;
  }
  if (group === "jobs" && action === "list") {
    printResult(await executeOperation("talend_jobs_list", { limit: intOption("limit", 50), offset: intOption("offset", 0) }));
    return;
  }
  if (group === "jobs" && action === "show") {
    if (!arg1) fail("Uso: talend jobs show <nombre>", "INVALID_INPUT");
    printResult(await executeOperation("talend_jobs_read", { jobName: arg1, ...(values.folder ? { folderPath: values.folder } : {}) }));
    return;
  }
  if (group === "jobs" && action === "create") {
    if (!arg1) fail("Uso: talend jobs create <nombre>", "INVALID_INPUT");
    await confirmWrite(`crear job ${arg1}`);
    printResult(await executeOperation("talend_jobs_create", { jobName: arg1, ...(values.folder ? { folderPath: values.folder } : {}) }, { allowWrite: true }));
    return;
  }
  if (group === "tools" && action === "list") {
    printResult(listOperations());
    return;
  }
  if (group === "tools" && action === "describe") {
    if (!arg1) fail("Uso: talend tools describe <nombre>", "INVALID_INPUT");
    printResult(describeOperation(arg1));
    return;
  }
  if (group === "tools" && action === "call") {
    if (!arg1) fail("Uso: talend tools call <nombre> --input '{...}'", "INVALID_INPUT");
    const risk = describeOperation(arg1).risk as "read" | "write" | "execute" | "destructive" | "unclassified";
    const input = await inputJson();
    if (risk === "write" && !values.yes) await confirmWrite(arg1);
    const result = await executeOperation(arg1, input, {
      allowWrite: risk === "write" && (values.yes || process.env.TALEND_MCP_ALLOW_WRITE === "1" || process.env.TALEND_MCP_ALLOW_WRITE === "true"),
      allowExecute: risk === "execute" && (values.yes || process.env.TALEND_MCP_ALLOW_EXECUTE === "1" || process.env.TALEND_MCP_ALLOW_EXECUTE === "true"),
      allowDestructive: risk === "destructive" && (values.yes || process.env.TALEND_MCP_ALLOW_DESTRUCTIVE === "1" || process.env.TALEND_MCP_ALLOW_DESTRUCTIVE === "true"),
      confirm: (input as { confirm?: unknown }).confirm === true,
    });
    printResult(result);
    return;
  }
  fail(`Comando no reconocido: ${positionals.join(" ")}\n\n${HELP}`, "UNKNOWN_COMMAND");
}

try {
  await main();
} catch (error) {
  const known = error instanceof CliOperationError;
  const code = known ? error.code : "UNEXPECTED";
  const message = error instanceof Error ? error.message : String(error);
  if (values.json) console.log(JSON.stringify({ ok: false, error: { code, message } }));
  else console.error(`Error [${code}]: ${message}`);
  process.exitCode = code === "NOT_FOUND" ? 3
    : code === "CANCELLED" ? 4
      : code === "DENIED" || code === "NEEDS_CONFIRMATION" || code === "UNCLASSIFIED" ? 5
        : code === "INVALID_INPUT" || code === "INVALID_PROJECT" ? 2 : 1;
}
