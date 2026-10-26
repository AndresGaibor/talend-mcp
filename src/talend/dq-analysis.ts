/**
 * Fachada del análisis de calidad de datos de Talend (`.ana`).
 *
 * El parseo del XML vive en `dq-analysis/parse.ts`, el listado en
 * `dq-analysis/list.ts` y el formateo de la salida en `dq-analysis/format.ts`.
 */

export { formatDQAnalysis, formatDQAnalysesDetails, formatDQAnalysesList } from "./dq-analysis/format";
export { listDQAnalyses } from "./dq-analysis/list";
export { parseDQAnalysis } from "./dq-analysis/parse";
export type { DQAnalysis, DQIndicator } from "./dq-analysis/types";
