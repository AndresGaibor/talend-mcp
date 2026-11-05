import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { getRuntimeTools } from "../../../server/registered-tools";
import { GENERIC_TOOL_OUTPUT_SCHEMA } from "../tool-registry";
import { buildServerInstructions } from "../../../modules/guide/domain/server-instructions";
import { getTalendMcpEnv } from "../../../config/env";
import { CupoDeLlamadas } from "./tool-guard";
import { dispatchValidated } from "./dispatch";

function toStandardSchema(schema: unknown) {
  return schema && typeof schema === "object" && "~standard" in schema
    ? schema
    : fromJsonSchema(schema as Parameters<typeof fromJsonSchema>[0]);
}

export function createNewMcpServer() {
  const server = new McpServer(
    { name: "talend-mcp", version: "1.0.0" },
    { instructions: buildServerInstructions() },
  );
  const allTools = getRuntimeTools();
  const env = getTalendMcpEnv();
  const cupo = new CupoDeLlamadas(env.TALEND_MCP_MAX_CONCURRENT_CALLS);

  for (const tool of allTools) {
    server.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: toStandardSchema(tool.definition.inputSchema) as Parameters<typeof server.registerTool>[1]["inputSchema"],
        outputSchema: toStandardSchema(tool.definition.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA) as Parameters<typeof server.registerTool>[1]["outputSchema"],
        annotations: tool.definition.annotations as Parameters<typeof server.registerTool>[1]["annotations"],
        _meta: tool.definition._meta as Record<string, unknown>,
        title: tool.definition.name,
      },
      (async (input: unknown) => {
        return dispatchValidated(
          tool.definition.name,
          input,
          tool.definition.inputSchema,
          tool.handler,
          { timeoutMs: env.TALEND_MCP_TOOL_TIMEOUT_MS, cupo },
        ) as never;
      }) as never,
    );
  }
  return server;
}

export const createTalendMcpServer = createNewMcpServer;
