import type { TalendStudioBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { editoresAbiertosPor, type EditorAbierto } from "./editores-guardados";

type PuenteDeEditores = Pick<TalendStudioBridgeClient, "workbenchState" | "closeEditor">;

/** Editores abiertos ahora en Studio, o null si no se pudo leer (entonces no se cierra nada). */
export async function editoresAbiertos(bridge: PuenteDeEditores): Promise<EditorAbierto[] | null> {
  try {
    const estado = await bridge.workbenchState();
    if (!estado.ok) return null;
    return (estado.data?.windows ?? []).flatMap((ventana) => (ventana.openEditors ?? []) as EditorAbierto[]);
  } catch {
    return null;
  }
}

/**
 * Cierra el editor que una operacion abrio para un job, sin guardar ni descartar nada.
 *
 * @param antes editores abiertos antes de la operacion (null: no se sabe cuales eran, no se cierra nada).
 * @returns los titulos cerrados.
 */
export async function cerrarEditoresAbiertosPor(
  bridge: PuenteDeEditores,
  job: string,
  antes: EditorAbierto[] | null,
): Promise<string[]> {
  if (antes === null) return [];
  const despues = await editoresAbiertos(bridge);
  if (despues === null) return [];
  const cerrados: string[] = [];
  for (const title of editoresAbiertosPor(job, antes, despues)) {
    try {
      const cierre = await bridge.closeEditor(title, false);
      if (cierre.ok && cierre.data?.closed === true) cerrados.push(title);
    } catch {
      // Un editor que no se deja cerrar solo cuesta memoria: no debe romper la operacion.
    }
  }
  return cerrados;
}
