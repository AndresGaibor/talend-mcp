/**
 * Jobs que Studio tiene abiertos en un editor.
 *
 * Editar el `.item` de un job abierto deja obsoleto el modelo del editor: al guardar, Studio pisa el cambio
 * (o el job queda mezclado). Antes de escribir en disco se pregunta al bridge, si hay uno. Sin Studio abierto no
 * hay editor que se desincronice, y la comprobacion no impide nada.
 */
export async function jobsAbiertosEnStudio(jobs: string[]): Promise<string[]> {
  if (jobs.length === 0) return [];
  try {
    const { createBridgeClient } = await import("../../modules/studio-bridge/adapters/http-studio-bridge.client");
    const bridge = await createBridgeClient({ config: { timeoutMs: 5_000 } });
    const estado = await bridge.workbenchState();
    if (!estado.ok) return [];
    const ventanas = (estado.data as { windows?: Array<{ openEditors?: Array<{ title?: string }> }> } | undefined)?.windows ?? [];
    const titulos = ventanas.flatMap((ventana) => (ventana.openEditors ?? []).map((editor) => editor.title ?? ""));
    return jobs.filter((job) => titulos.some((titulo) => esEditorDelJob(titulo, job)));
  } catch {
    return [];
  }
}

/**
 * Si el titulo de un editor corresponde al job.
 *
 * Eclipse/Talend puede presentar `Job NOMBRE 0.1`, `*Job NOMBRE 0.1` o solo
 * `NOMBRE 0.1` segun la vista y la version. Se busca el nombre con limites de
 * palabra para no confundir, por ejemplo, `MIG_A` con `MIG_AB`.
 */
export function esEditorDelJob(titulo: string, job: string): boolean {
  const escapado = job.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const limpio = titulo.trim().replace(/^\*+\s*/, "");
  return new RegExp(`(?:^|[^A-Za-z0-9_])${escapado}(?=$|[^A-Za-z0-9_])`, "i").test(limpio);
}
