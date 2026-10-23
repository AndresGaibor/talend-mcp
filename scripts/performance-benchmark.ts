/** Benchmark local del arranque HTTP y de tools/list; no ejecuta tools con efectos. */
const importStartedAt = performance.now();
const { runNewHttpServer } = await import("../src/presentation/server/new-server");
const importMs = performance.now() - importStartedAt;

const startupStartedAt = performance.now();
const server = await runNewHttpServer({ port: 0 });
const startupMs = performance.now() - startupStartedAt;

try {
  const samples: number[] = [];
  let responseBytes = 0;
  let toolCount = 0;

  for (let i = 0; i < 8; i++) {
    const startedAt = performance.now();
    const response = await fetch(`${server.localUrl}/mcp`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "tools/list", params: {} }),
    });
    const text = await response.text();
    samples.push(performance.now() - startedAt);
    responseBytes = Buffer.byteLength(text);

    if (!response.ok) throw new Error(`tools/list respondio HTTP ${response.status}`);
    const payload = JSON.parse(text) as { result?: { tools?: unknown[] } };
    toolCount = payload.result?.tools?.length ?? 0;
  }

  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({
    preset: process.env.TALEND_MCP_FILTER ?? "all (default)",
    tools: toolCount,
    responseBytes,
    importMs: rounded(importMs),
    startupMs: rounded(startupMs),
    toolsListMedianMs: rounded(samples[Math.floor(samples.length / 2)]!),
    toolsListP95Ms: rounded(samples[Math.ceil(samples.length * 0.95) - 1]!),
  }, null, 2));
} finally {
  await server.close();
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}
