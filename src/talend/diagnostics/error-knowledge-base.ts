/**
 * Fachada de la base de conocimiento de errores de Talend Studio.
 *
 * El catalogo inicial vive en `error-knowledge-base/catalog.ts`, la
 * persistencia en `.talend-mcp/error-knowledge-base.json` en
 * `error-knowledge-base/store.ts`, las consultas en
 * `error-knowledge-base/queries.ts` y las sugerencias y estadisticas en
 * `error-knowledge-base/advice.ts`.
 */

export type { ErrorKnowledgeBase, KnownError } from "./error-knowledge-base/types";
export { getKnowledgeBase } from "./error-knowledge-base/store";
export {
  addCustomError,
  analyzeError,
  getErrorById,
  getErrorsByCategory,
  getLatestErrors,
} from "./error-knowledge-base/queries";
export { getErrorStats, suggestFix } from "./error-knowledge-base/advice";
