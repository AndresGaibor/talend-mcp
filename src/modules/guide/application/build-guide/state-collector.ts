import type { McpToolDefinition } from "../../../../server/adapt-tool";
import { getConfiguredProjectPath } from "../../../../talend/workspace";
import type { GuideToolSummary } from "../../domain/guide.types";
import { toSummary } from "./summaries";

/** Resúmenes de las tools que expone el preset actual. */
export function collectToolSummaries(listTools: () => McpToolDefinition[]): GuideToolSummary[] {
  return listTools().map(toSummary);
}

/** Estado del proyecto configurado y del bridge de Studio. */
export type EnvironmentState = {
  project: string | null;
  bridge: Record<string, unknown>;
  diagnostics: string[];
};

/** Reúne el proyecto activo y la respuesta del bridge sin lanzar errores. */
export async function collectEnvironmentState(): Promise<EnvironmentState> {
  const project = getConfiguredProjectPath() ?? null;
  const diagnostics: string[] = [];
  let bridge: Record<string, unknown> = { connected: false };

  try {
    const { createBridgeClient } = await import(
      "../../../studio-bridge/adapters/http-studio-bridge.client"
    );
    const client = await createBridgeClient();
    const ping = await client.ping();
    const data = (ping.data ?? {}) as Record<string, unknown>;
    bridge = {
      connected: ping.ok,
      endpoint: client.getConfig().host + ":" + client.getConfig().port,
      ...(ping.ok
        ? {
            plugin: data.plugin,
            version: data.version,
            mode: data.mode,
            unsafeActions: data.unsafeActions,
          }
        : { error: ping.error?.message ?? "sin respuesta" }),
    };
  } catch (err) {
    bridge = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!project) {
    diagnostics.push(
      "No hay proyecto configurado. Define TALEND_PROJECT (la carpeta que contiene talend.project) o abre el proyecto en Studio.",
    );
  }
  if (bridge.connected !== true) {
    diagnostics.push(
      "El bridge de Studio no responde. Abre Talend Studio con el plugin instalado (`bun run scripts/start.ts --install-bridge`).",
    );
  }

  return { project, bridge, diagnostics };
}
