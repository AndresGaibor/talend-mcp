import { analyzeError } from "./queries";
import { loadKnowledgeBase } from "./store";
import type { KnownError } from "./types";

/** Sugerencia de correccion para un mensaje de error. */
export function suggestFix(errorMessage: string): { error: KnownError | null; advice: string } {
  const err = analyzeError(errorMessage);
  if (!err) {
    return {
      error: null,
      advice: "Error desconocido. Revisa el mensaje completo y busca en los logs de Talend Studio.",
    };
  }
  let advice = `Categoría: ${err.category}\nCausa: ${err.cause}\nSolución sugerida: ${err.suggestedFix}`;
  if (err.canAutoFix) {
    advice += "\n⚡ Este error puede auto-corregirse.";
  }
  return { error: err, advice };
}

/** Totales de ocurrencias por categoria y cuantos errores son auto-corregibles. */
export function getErrorStats(): { total: number; byCategory: Record<string, number>; autoFixable: number } {
  const kb = loadKnowledgeBase();
  const byCategory: Record<string, number> = {};
  for (const err of kb.errors) {
    byCategory[err.category] = (byCategory[err.category] ?? 0) + err.occurrences;
  }
  return {
    total: kb.errors.reduce((sum, e) => sum + e.occurrences, 0),
    byCategory,
    autoFixable: kb.errors.filter((e) => e.canAutoFix).length,
  };
}
