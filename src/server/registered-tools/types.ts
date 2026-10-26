import type { McpToolDefinition } from "../adapt-tool";

/** Tool lista para ejecutar: definicion MCP ya adaptada y su handler. */
export type RuntimeTool = {
  definition: McpToolDefinition;
  handler: (input: unknown) => Promise<unknown>;
};
