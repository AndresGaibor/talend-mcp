import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runNewHttpServer } from "../../src/presentation/server/new-server";
import { idempotencyStore } from "../../src/presentation/server/new-server/idempotency-store";

const fixture = join(import.meta.dir, "..", "fixtures", "talend");
const sandbox = mkdtempSync(join(tmpdir(), "talend-http-idempotency-"));
const project = join(sandbox, "project");
const processDir = join(project, "process", "idempotency-fixture");
mkdirSync(processDir, { recursive: true });
copyFileSync(join(fixture, "lab04_olist_orders_to_staging_0.1.item"), join(processDir, "lab04_olist_orders_to_staging_0.1.item"));
copyFileSync(join(fixture, "lab04_olist_orders_to_staging_0.1.properties"), join(processDir, "lab04_olist_orders_to_staging_0.1.properties"));

const trackedEnv = ["TALEND_PROJECT", "TALEND_DISABLE_AUTODETECT", "TALEND_MCP_ALLOW_DESTRUCTIVE", "TALEND_MCP_FILTER", "TALEND_MCP_IDEMPOTENCY_DIR"] as const;
const previousEnv = Object.fromEntries(trackedEnv.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of trackedEnv) {
    const value = previousEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

async function initialize(base: string): Promise<string> {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "idempotency-test", version: "1" } },
    }),
  });
  return response.headers.get("mcp-session-id") ?? "";
}

async function callTool(
  base: string,
  session: string,
  id: number,
  args: Record<string, unknown>,
  key: string,
  source: "header" | "meta" = "header",
) {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(source === "header" ? { "idempotency-key": key } : {}),
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        ...(source === "meta" ? { _meta: { idempotencyKey: key } } : {}),
        name: "talend_delete_job",
        arguments: args,
      },
    }),
  });
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .find((line) => line.startsWith("{"));
    if (!data) throw new Error(`La respuesta SSE no contiene un evento JSON: ${body}`);
    return JSON.parse(data) as Record<string, any>;
  }
  return JSON.parse(body) as Record<string, any>;
}

describe("idempotencia por HTTP MCP", () => {
  test("reproduce la respuesta previa y rechaza la clave si cambia el payload", async () => {
    process.env.TALEND_PROJECT = project;
    process.env.TALEND_DISABLE_AUTODETECT = "1";
    process.env.TALEND_MCP_ALLOW_DESTRUCTIVE = "1";
    process.env.TALEND_MCP_FILTER = "all";
    process.env.TALEND_MCP_IDEMPOTENCY_DIR = join(sandbox, "idempotency-store");

    const server = await runNewHttpServer({ port: 0 });
    try {
      const session = await initialize(server.localUrl);
      const input = { jobName: "lab04_olist_orders_to_staging", dryRun: true, confirm: true };
      const first = await callTool(server.localUrl, session, 2, input, "http-roundtrip-key-001");
      expect(first.result?.isError).not.toBe(true);
      expect(JSON.stringify(first.result)).toContain("lab04_olist_orders_to_staging_0.1.item");

      rmSync(join(project, "process", "idempotency-fixture"), { recursive: true, force: true });
      const replay = await callTool(server.localUrl, session, 3, input, "http-roundtrip-key-001");
      expect(replay.result).toEqual(first.result);
      expect(JSON.stringify(replay.result)).toContain("lab04_olist_orders_to_staging_0.1.item");

      const mismatch = await callTool(server.localUrl, session, 4, { ...input, jobName: "otro_job" }, "http-roundtrip-key-001");
      expect(mismatch.result?.isError).toBe(true);
      expect(JSON.stringify(mismatch)).toContain("La clave de idempotencia ya se uso con una solicitud diferente.");

      mkdirSync(processDir, { recursive: true });
      copyFileSync(join(fixture, "lab04_olist_orders_to_staging_0.1.item"), join(processDir, "lab04_olist_orders_to_staging_0.1.item"));
      copyFileSync(join(fixture, "lab04_olist_orders_to_staging_0.1.properties"), join(processDir, "lab04_olist_orders_to_staging_0.1.properties"));
      const metaInput = { jobName: "lab04_olist_orders_to_staging", dryRun: true, confirm: true };
      const metaFirst = await callTool(server.localUrl, session, 5, metaInput, "mcp-meta-roundtrip-001", "meta");
      expect(metaFirst.result?.isError).not.toBe(true);
      expect(JSON.stringify(metaFirst.result)).toContain("lab04_olist_orders_to_staging_0.1.item");

      rmSync(join(project, "process", "idempotency-fixture"), { recursive: true, force: true });
      const metaReplay = await callTool(server.localUrl, session, 6, metaInput, "mcp-meta-roundtrip-001", "meta");
      expect(metaReplay.result).toEqual(metaFirst.result);
    } finally {
      await server.close();
      idempotencyStore.close();
    }
  }, 15_000);
});
