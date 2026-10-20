import { runNewHttpServer, runNewStdioServer } from "./src/presentation/server/new-server";
import { detectProjectFromBridge } from "./src/talend/workspace";

const mode = process.env.TALEND_MCP_MODE ?? "http";

// Detecta el proyecto Talend abierto en Studio (via el bridge). Si el bridge no
// esta instalado o Studio no esta abierto, se sigue sin proyecto: las tools
// vuelven a resolverlo en cada llamada.
const detectedProject = await detectProjectFromBridge();
if (detectedProject) {
  console.error(`Proyecto Talend detectado: ${detectedProject}`);
}

if (mode === "http") {
  const port = Number(process.env.TALEND_MCP_PORT) || 3927;
  const host = process.env.TALEND_MCP_HOST || "127.0.0.1";
  const live = process.env.TALEND_MCP_LIVE !== "false";

  const handle = await runNewHttpServer({
    port,
    host,
    live,
  });

  console.error(`Talend MCP server running:`);
  console.error(`  Local:  ${handle.localUrl}/mcp`);
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
  await runNewStdioServer({ live });
}
