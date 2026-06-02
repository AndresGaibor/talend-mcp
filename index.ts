import { runStdioServer, runHttpServer } from "./src/server";

const mode = process.env.TALEND_MCP_MODE ?? "http";

if (mode === "http") {
  const port = Number(process.env.TALEND_MCP_PORT) || 3927;
  const host = process.env.TALEND_MCP_HOST || "127.0.0.1";
  const autoFunnel = process.env.TALEND_MCP_FUNNEL !== "false";
  const live = process.env.TALEND_MCP_LIVE !== "false";

  const handle = await runHttpServer({
    port,
    host,
    autoFunnel,
    live,
  });

  console.error(`Talend MCP server running:`);
  console.error(`  Local:  ${handle.localUrl}/mcp`);
  if (handle.publicUrl) {
    console.error(`  Public: ${handle.publicUrl}`);
  }
  console.error(`  Health: ${handle.localUrl}/healthz`);

  process.on("SIGINT", async () => {
    await handle.close();
    process.exit(0);
  });
  if (process.platform !== "win32") {
    process.on("SIGTERM", async () => {
      await handle.close();
      process.exit(0);
    });
  }
} else {
  const live = process.env.TALEND_MCP_LIVE !== "false";
  await runStdioServer({ live, stderr: process.stderr });
}
