/**
 * Editores de jobs que se pueden cerrar sin perder nada.
 *
 * Cerrar un editor con cambios sin guardar descarta esos cambios. El bridge cierra
 * por titulo y no sabe cual de dos copias con el mismo titulo cerrar, asi que si
 * alguna copia tiene cambios se conserva el titulo entero. Un editor cuyo estado
 * no se conoce tambien se conserva.
 */

/** Id del editor de un job en Talend Studio. */
export const EDITOR_DE_JOB = "org.talend.designer.core.ui.MultiPageTalendEditor";

export type EditorAbierto = {
  title: string;
  id?: string;
  dirty?: boolean;
};

export type PlanDeCierre = {
  /** Un titulo por cada editor que se cierra (repetido si hay copias). */
  cerrar: string[];
  /** Titulos que se dejan abiertos y por que. */
  conservar: Array<{ title: string; motivo: string }>;
};

/** Nombre del job de un titulo de editor: `Job MCP_L5_Join 0.1` -> `MCP_L5_Join 0.1`. */
function nombreDelJob(title: string): string | undefined {
  const limpio = title.startsWith("*") ? title.slice(1) : title;
  return limpio.startsWith("Job ") ? limpio.slice("Job ".length) : undefined;
}

/**
 * Decide que editores de jobs se cierran.
 *
 * @param prefijo solo jobs cuyo nombre empieza por este texto (vacio: todos).
 */
export function planificarCierre(editores: EditorAbierto[], prefijo?: string): PlanDeCierre {
  const porTitulo = new Map<string, EditorAbierto[]>();
  for (const editor of editores) {
    if (editor.id !== EDITOR_DE_JOB) continue;
    const job = nombreDelJob(editor.title);
    if (job === undefined) continue;
    if (prefijo && !job.startsWith(prefijo)) continue;
    const copias = porTitulo.get(editor.title) ?? [];
    copias.push(editor);
    porTitulo.set(editor.title, copias);
  }

  const plan: PlanDeCierre = { cerrar: [], conservar: [] };
  for (const [title, copias] of porTitulo) {
    if (copias.some((copia) => copia.dirty === true)) {
      plan.conservar.push({ title, motivo: "tiene cambios sin guardar" });
      continue;
    }
    if (copias.some((copia) => copia.dirty !== false)) {
      plan.conservar.push({ title, motivo: "no se sabe si tiene cambios sin guardar" });
      continue;
    }
    plan.cerrar.push(...copias.map(() => title));
  }
  return plan;
}
