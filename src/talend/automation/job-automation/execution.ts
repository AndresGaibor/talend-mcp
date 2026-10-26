import type { TalendStudioBridgeClient } from "../../studio/bridge-client";
import { validateJobAutomation } from "./validation";

export async function runJobAutomation(
  projectPath: string,
  jobName: string,
  bridge?: TalendStudioBridgeClient,
  options?: {
    unsafeActions?: boolean;
    contextName?: string;
    waitForTermination?: boolean;
    timeoutMs?: number;
  },
): Promise<{ ok: boolean; exitCode?: number; durationMs?: number; output?: string; errors: string[] }> {
  const errors: string[] = [];

  if (!bridge) {
    return { ok: false, errors: ["Bridge no disponible"] };
  }

  try {
    const saveResult = await bridge.saveAllEditors();
    if (!saveResult.ok) {
      errors.push("No se pudo guardar el editor activo");
    }

    await bridge.refreshWorkspace();

    const validate = await validateJobAutomation(projectPath, jobName, bridge);
    if (validate.problemsCount > 0) {
      errors.push("El job tiene " + validate.problemsCount + " problemas antes de ejecutar");
    }

    const runResult = await bridge.runActiveJob({
      dryRun: !(options?.unsafeActions ?? false),
      saveBefore: true,
      waitForTermination: options?.waitForTermination ?? false,
      timeoutMs: options?.timeoutMs ?? 60_000,
    });

    return {
      ok: runResult.ok,
      exitCode: (runResult.data as any)?.exitCode,
      durationMs: (runResult.data as any)?.durationMs,
      output: (runResult.data as any)?.output,
      errors,
    };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
