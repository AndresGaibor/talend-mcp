import type { TalendStudioBridgeClient } from "../../studio/bridge-client";

export async function validateJobAutomation(
  projectPath: string,
  jobName: string,
  bridge?: TalendStudioBridgeClient,
): Promise<{ ok: boolean; problemsCount: number; errors: string[] }> {
  if (!bridge) {
    return { ok: false, problemsCount: 0, errors: ["Bridge no disponible"] };
  }

  try {
    const modelResult = await bridge.activeJobModel();
    if (!modelResult.ok) {
      return { ok: false, problemsCount: 0, errors: ["No se pudo obtener el modelo del job"] };
    }

    const problemsResult = await bridge.problemsMarkers();
    const problemsCount = problemsResult.ok ? ((problemsResult.data as any)?.markers?.length ?? 0) : 0;

    return { ok: true, problemsCount, errors: [] };
  } catch (e) {
    return { ok: false, problemsCount: 0, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
