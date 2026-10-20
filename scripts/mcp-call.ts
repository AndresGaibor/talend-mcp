/**
 * Cliente de linea de comandos para invocar una tool del MCP de Talend.
 *
 *   bun run scripts/mcp-call.ts talend_jobs_list '{}'
 *   bun run scripts/mcp-call.ts talend_jobs_list '{"limit":5}' --raw
 *
 * Sirve para ejecutar las pruebas del plan contra el servidor MCP local sin
 * depender de un cliente MCP externo.
 */

const args = process.argv.slice(2);
const toolName = args[0];
const rawArgs = args[1] ?? "{}";
const asRaw = args.includes("--raw");

if (!toolName) {
  console.error("Uso: bun run scripts/mcp-call.ts <tool> [json-args] [--raw]");
  process.exit(1);
}

const url = process.env.TALEND_MCP_URL ?? "http://127.0.0.1:3927/mcp";

// Los argumentos se pueden pasar como JSON en linea o con @archivo.json.
let jsonText = rawArgs;
if (rawArgs.startsWith("@")) {
  jsonText = await Bun.file(rawArgs.slice(1)).text();
}

let parsedArgs: unknown;
try {
  parsedArgs = JSON.parse(jsonText);
} catch (error) {
  console.error(`Argumentos invalidos: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const payload = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: toolName, arguments: parsedArgs },
};

let response: Response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
} catch (error) {
  console.error(`No se pudo contactar al MCP en ${url}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const body = (await response.json()) as {
  result?: { content?: Array<{ type: string; text: string }>; structuredContent?: unknown; isError?: boolean };
  error?: { code: number; message: string };
};

if (body.error) {
  console.error(`Error JSON-RPC ${body.error.code}: ${body.error.message}`);
  process.exit(1);
}

const result = body.result;
if (!result) {
  console.error("Respuesta sin resultado");
  process.exit(1);
}

if (asRaw) {
  console.log(JSON.stringify(result.structuredContent ?? result, null, 2));
} else {
  const text = result.content?.map((item) => item.text).join("\n") ?? "";
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

if (result.isError) process.exit(2);
