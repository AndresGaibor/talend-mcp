import { StdioServerTransport } from "@modelcontextprotocol/server";
import { createNewMcpServer } from "./common";

export async function runNewStdioServer(): Promise<void> {
  const server = createNewMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
