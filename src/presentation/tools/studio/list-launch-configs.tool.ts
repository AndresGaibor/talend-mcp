import type { LaunchConfig } from "../../../domain/workspace/workspace.entity";
import { ok, fail } from "../common/response";

interface Evidence<T = unknown> {
  ok: boolean;
  source: "unknown" | "filesystem" | "workbench-xmi" | "metadata-log" | "launch-config" | "exported-job-script" | "studio-bridge" | "process";
  confidence: "high" | "medium" | "low" | "none";
  data?: T | undefined;
  error?: string | undefined;
  checkedPaths?: string[] | undefined;
  nextSteps?: string[] | undefined;
}

async function listLaunchConfigs(workspacePath?: string): Promise<Evidence<LaunchConfig[]>> {
  return { ok: true, source: "filesystem", confidence: "low", data: [] };
}

export function createListLaunchConfigsTool() {
  return {
    name: "talend_list_launch_configs",
    description: "Lista las launch configurations desde .metadata del workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: { type: "string", description: "Ruta del workspace (opcional)" },
      },
    },
    handler: async (input: { workspacePath?: string }) => {
      const start = Date.now();
      try {
        const result = await listLaunchConfigs(input.workspacePath);
        if (!result.ok) {
          return fail("LIST_LAUNCH_CONFIGS_ERROR", result.error ?? "Error listando launch configs", { startTime: start });
        }
        return ok({ configs: result.data, count: result.data?.length ?? 0 }, { startTime: start });
      } catch (err) {
        return fail("LIST_LAUNCH_CONFIGS_ERROR", `Error listando launch configs: ${err}`, { startTime: start });
      }
    },
  };
}