import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { listPresentationAppIds, registerPresentationAppResources } from "../apps";
import { getAllRuntimeTools, getRuntimeTools } from "../../server/registered-tools";
import { GENERIC_TOOL_OUTPUT_SCHEMA } from "./tool-registry";
import { resolvePublicUrl } from "../../tailscale/resolve-public-url";

export interface NewServerOptions {
  port?: number;
  host?: string;
  autoFunnel?: boolean;
  live?: boolean;
}

export interface NewServerHandle {
  localUrl: string;
  publicUrl: string | null;
  close(): Promise<void>;
}

function createHealthPayload() {
  return {
    ok: true,
    service: "talend-mcp",
    version: "1.0.0",
    toolCount: getAllRuntimeTools().length + listPresentationAppIds().length,
  };
}

function isLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://127.0.0.1:") || origin.startsWith("http://localhost:");
}

function isOpenAIOrigin(origin: string): boolean {
  return origin === "https://chatgpt.com" || origin === "https://chat.openai.com" || origin.endsWith(".openai.com");
}

function isAllowedOrigin(origin: string | undefined, allowOrigins: string[] = []): boolean {
  if (!origin) return true;
  if (allowOrigins.includes("*")) return true;
  if (allowOrigins.includes(origin)) return true;
  return isLocalOrigin(origin) || isOpenAIOrigin(origin);
}

async function runProcess(command: string, args: string[], timeoutMs = 10_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0, stdout, stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr });
    });
  });
}

export function createNewMcpServer(options?: { live?: boolean; stderr?: NodeJS.WritableStream }) {
  const server = new McpServer({ name: "talend-mcp", version: "1.0.0" });
  const allTools = getRuntimeTools();

  for (const tool of allTools) {
    server.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema as Parameters<typeof server.registerTool>[1]["inputSchema"],
        outputSchema: (tool.definition.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA) as Parameters<typeof server.registerTool>[1]["outputSchema"],
        annotations: tool.definition.annotations as Parameters<typeof server.registerTool>[1]["annotations"],
      },
      tool.handler as never,
    );
  }

  registerPresentationAppResources(server);

  return server;
}

export const createTalendMcpServer = createNewMcpServer;

export async function runNewStdioServer(options?: { live?: boolean }): Promise<void> {
  const server = createNewMcpServer({ live: options?.live, stderr: process.stderr });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function runNewHttpServer(options?: NewServerOptions): Promise<NewServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const path = "/mcp";

  const server = createNewMcpServer({ live: options?.live, stderr: process.stderr });

  const httpServer = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    if (requestUrl.pathname === "/healthz") {
      const payload = createHealthPayload();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (requestUrl.pathname === "/.well-known/oauth-protected-resource") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        resource: `http://${host}:${listenPort}/mcp`,
      }));
      return;
    }

    if (requestUrl.pathname !== path) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }

    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin, [])) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
      return;
    }

    const accept = req.headers.accept ?? "";
    if (req.method === "GET" && !accept.includes("text/event-stream")) {
      const payload = createHealthPayload();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (!accept.includes("text/event-stream")) {
      req.headers.accept = accept ? `${accept}, text/event-stream` : "application/json, text/event-stream";
    }

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  const listenPort = await new Promise<number>((resolve, reject) => {
    const listen = (p: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        httpServer.off("error", onError);
        if (error.code === "EADDRINUSE" && p !== 0) { listen(0); return; }
        reject(error);
      };
      httpServer.once("error", onError);
      httpServer.listen(p, host, () => {
        httpServer.off("error", onError);
        const addr = httpServer.address();
        if (addr && typeof addr === "object") { resolve(addr.port); return; }
        reject(new Error("Could not determine port"));
      });
    };
    listen(port);
  });

  const localUrl = `http://${host}:${listenPort}`;
  let publicUrl: string | null = null;

  if (options?.autoFunnel !== false) {
    const tsStatus = await runProcess("tailscale", ["status", "--json"], 10_000);
    if (tsStatus.ok) {
      const funnelResult = await runProcess("tailscale", ["funnel", "--bg", "--yes", "--https=443", String(listenPort)], 15_000);
      if (funnelResult.ok) {
        publicUrl = await resolvePublicUrl({
          path: "/mcp",
          timeoutMs: 15_000,
          intervalMs: 1_000,
          readTailscaleStatus: async () =>
            (await runProcess("tailscale", ["status", "--json"])).stdout,
          readFunnelStatus: async () =>
            (await runProcess("tailscale", ["funnel", "status", "--json"])).stdout,
          publicPort: 443,
        });
      }
    }
  }

  return {
    localUrl,
    publicUrl,
    async close() {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
