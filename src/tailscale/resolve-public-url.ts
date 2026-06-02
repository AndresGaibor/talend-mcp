import { extractPublicUrl } from "./parse-status";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResolvePublicUrlInput = {
  path: string;
  timeoutMs: number;
  intervalMs: number;
  readTailscaleStatus: () => Promise<string>;
  readFunnelStatus: () => Promise<string>;
  publicPort?: number;
};

export async function resolvePublicUrl(input: ResolvePublicUrlInput): Promise<string | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < input.timeoutMs) {
    const tailscaleStatus = await input.readTailscaleStatus();
    const funnelStatus = await input.readFunnelStatus();

    try {
      const parsedStatus = JSON.parse(tailscaleStatus) as { Self?: { DNSName?: string } };
      const parsedFunnel = JSON.parse(funnelStatus) as Record<string, unknown>;
      const publicUrl = extractPublicUrl(parsedStatus, parsedFunnel as never, input.path, input.publicPort);

      if (publicUrl) {
        return publicUrl;
      }
    } catch {
      // Reintentar hasta que Funnel estabilice
    }

    await sleep(input.intervalMs);
  }

  return null;
}
