import { runNewHttpServer, runNewStdioServer } from "./src/presentation/server/new-server";
import { detectProjectFromBridge } from "./src/talend/workspace";

const mode = process.env.TALEND_MCP_MODE ?? "http";

/**
 * Calienta la deteccion del proyecto sin bloquear el arranque.
 *
 * Si el bridge no esta instalado o Studio no esta abierto, la consulta puede
 * esperar hasta el timeout del bridge. El servidor ya atiende `/healthz` y
 * `tools/list` mientras tanto; las tools que necesitan el proyecto lo resuelven
 * en su propia llamada.
 */
function prewarmProjectDetection(): void {
  void detectProjectFromBridge()
    .then((project) => {
      if (project) console.error(`Proyecto Talend detectado: ${project}`);
    })
    .catch(() => {});
}

if (mode === "http") {
  const port = Number(process.env.TALEND_MCP_PORT) || 3927;
  const host = process.env.TALEND_MCP_HOST || "127.0.0.1";

  const handle = await runNewHttpServer({
    port,
    host,
  });

  console.error(`Talend MCP server running:`);
  console.error(`  Local:  ${handle.localUrl}/mcp`);
  console.error(`  Health: ${handle.localUrl}/healthz`);

  prewarmProjectDetection();

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
  prewarmProjectDetection();
  await runNewStdioServer();
}
