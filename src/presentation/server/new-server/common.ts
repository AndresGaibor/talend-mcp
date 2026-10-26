import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { getRuntimeTools } from "../../../server/registered-tools";
import { GENERIC_TOOL_OUTPUT_SCHEMA } from "../tool-registry";
import { buildServerInstructions } from "../../../modules/guide/domain/server-instructions";

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

  for (const tool of allTools) {
    server.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: toStandardSchema(tool.definition.inputSchema) as Parameters<typeof server.registerTool>[1]["inputSchema"],
        outputSchema: toStandardSchema(tool.definition.outputSchema ?? GENERIC_TOOL_OUTPUT_SCHEMA) as Parameters<typeof server.registerTool>[1]["outputSchema"],
        annotations: tool.definition.annotations as Parameters<typeof server.registerTool>[1]["annotations"],
      },
      tool.handler as never,
    );
  }
  return server;
}

export const createTalendMcpServer = createNewMcpServer;
