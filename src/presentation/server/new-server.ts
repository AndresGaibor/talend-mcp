import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { allTools as presentationTools } from "../tools/registry";
import { createStudioBridgeTools } from "../../talend/studio/bridge-tools";
import { studioToolDefs } from "../../tools/new-tools";
import { listPresentationAppIds, registerPresentationApps } from "../apps";

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

type ToolDef = {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (input: any) => Promise<unknown>;
};

const TOOL_NAME_ALIASES: Record<string, string> = {
  analyze_logs: "talend_analyze_logs",
  analyze_tdboutput: "talend_analyze_tdboutput",
  duplicate_analysis: "talend_duplicate_analysis",
  full_analysis: "talend_full_analysis",
  inspect_component: "talend_inspect_component",
  inspect_job: "talend_inspect_job",
  list_analyses: "talend_list_analyses",
  read_analysis: "talend_read_analysis",
  read_run_log: "talend_read_run_log",
  update_analysis: "talend_update_analysis",
  view_logs: "talend_view_logs",
  add_talend_connection: "talend_add_connection",
  delete_talend_component: "talend_delete_component",
  delete_talend_connection: "talend_delete_connection",
  duplicate_talend_component: "talend_duplicate_component",
  move_talend_component: "talend_move_component",
  patch_talend_component: "talend_patch_component",
  preview_delete_talend_component: "talend_preview_delete_component",
  preview_delete_talend_connection: "talend_preview_delete_connection",
  preview_talend_component_parameter: "talend_preview_component_parameter",
  preview_talend_schema_column: "talend_preview_schema_column",
  update_talend_component_parameter: "talend_update_component_parameter",
  update_talend_schema_column: "talend_update_schema_column",
  create_repository_context: "talend_create_repository_context",
  delete_repository_context: "talend_delete_repository_context",
  delete_repository_context_parameter: "talend_delete_repository_context_parameter",
  list_project_contexts: "talend_list_project_contexts",
  list_repository_contexts: "talend_list_repository_contexts",
  read_repository_context: "talend_read_repository_context",
  upsert_repository_context_parameter: "talend_upsert_repository_context_parameter",
  repo_pull: "talend_repo_pull",
  repo_setup: "talend_repo_setup",
  repo_sources: "talend_repo_sources",
  repo_status: "talend_repo_status",
  repo_switch: "talend_repo_switch",
  latest_changes: "talend_latest_changes",
  live_start: "talend_live_start",
  live_status: "talend_live_status",
  live_stop: "talend_live_stop",
  detect_open_jobs: "talend_detect_open_jobs",
  summarize_open_job: "talend_summarize_open_job",
  detect_process: "talend_studio_process",
  diagnose_environment: "talend_diagnose_environment",
  list_launch_configs: "talend_list_launch_configs",
  list_open_editors: "talend_list_open_editors",
  get_probable_active_job: "talend_get_probable_active_job",
  analyze_job: "talend_analyze_job",
};

function dedupeTools(tools: ToolDef[]): ToolDef[] {
  const seen = new Set<string>();
  const result: ToolDef[] = [];
  for (const tool of tools) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    result.push(tool);
  }
  return result;
}

function buildAliasTools(tools: ToolDef[]): ToolDef[] {
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
  const aliasTools: ToolDef[] = [];

  for (const [sourceName, aliasName] of Object.entries(TOOL_NAME_ALIASES)) {
    const sourceTool = toolByName.get(sourceName);
    if (!sourceTool || toolByName.has(aliasName)) continue;
    aliasTools.push({ ...sourceTool, name: aliasName });
  }

  return aliasTools;
}

const registeredTools = dedupeTools([
  ...presentationTools,
  ...createStudioBridgeTools(),
  ...studioToolDefs,
]);

const aliasTools = buildAliasTools(registeredTools);

function createHealthPayload() {
  return {
    ok: true,
    service: "talend-mcp",
    version: "1.0.0",
    toolCount: registeredTools.length + aliasTools.length + listPresentationAppIds().length,
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

function getToolAnnotations(name: string) {
  const writeTools = new Set([
    "talend_update_component_parameter", "talend_patch_component", "talend_update_schema_column",
    "talend_duplicate_component", "talend_add_connection", "talend_update_context",
    "talend_upsert_context", "talend_delete_context", "talend_update_job_metadata",
    "talend_update_analysis", "talend_duplicate_analysis", "talend_delete_component",
    "talend_delete_connection", "talend_move_component", "talend_create_job",
    "talend_create_folder", "talend_rename_job", "talend_delete_job", "talend_duplicate_job",
    "talend_move_job_to_folder", "talend_run_exported_job", "talend_live_start", "talend_live_stop",
    "create_repository_context", "upsert_repository_context_parameter", "delete_repository_context",
    "delete_repository_context_parameter", "repo_setup", "repo_pull",
  ]);
  const workspaceTools = new Set([
    "talend_detect_open_jobs", "talend_read_latest_run_log", "talend_read_job_errors",
    "talend_summarize_open_job", "talend_view_logs", "talend_analyze_logs",
  ]);
  return {
    readOnlyHint: !writeTools.has(name),
    idempotentHint: !writeTools.has(name),
    requiresWorkspace: workspaceTools.has(name),
  };
}

export function createNewMcpServer(options?: { live?: boolean; stderr?: NodeJS.WritableStream }) {
  const server = new McpServer({ name: "talend-mcp", version: "1.0.0" });

  for (const tool of [...registeredTools, ...aliasTools]) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as Parameters<typeof server.registerTool>[1]["inputSchema"],
        annotations: getToolAnnotations(tool.name),
      },
      tool.handler as never,
    );
  }

  registerPresentationApps(server);

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
        publicUrl = `https://${localUrl}/mcp`;
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
