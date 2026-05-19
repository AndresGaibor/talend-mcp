import { describe, expect, test } from "bun:test";
import { createTalendMcpServer } from "../../src/server";

describe("MCP server", () => {
  test("crea servidor MCP", () => {
    const server = createTalendMcpServer();
    expect(server).toBeDefined();
  });
});