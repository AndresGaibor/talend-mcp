import { okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { collectEnvironmentState } from "./state-collector";

/** Comprueba el proyecto configurado y la respuesta del bridge. */
export async function renderEnvironment(): Promise<TalendResult> {
  const { project, bridge, diagnostics } = await collectEnvironmentState();

  return okResult(
    {
      project,
      projectSource: process.env.TALEND_PROJECT ? "TALEND_PROJECT" : "autodeteccion",
      bridge,
      diagnostics,
    },
    "talend_guide",
    project && bridge.connected === true ? "high" : "low",
    {
      nextActions: project
        ? [{ label: "Listar los jobs del proyecto", toolName: "talend_jobs_list", input: { limit: 20 } }]
        : [{ label: "Ver como configurar el entorno", toolName: "talend_guide", input: { mode: "task", task: "orientarse" } }],
    },
  );
}
