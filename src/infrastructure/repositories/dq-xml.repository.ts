/**
 * Fachada del repositorio XML de análisis DQ.
 *
 * La lectura y el listado viven en `dq-xml/read.ts`, la actualización de los
 * metadatos en `dq-xml/update.ts` y el duplicado en `dq-xml/duplicate.ts`.
 */

export { listDqAnalyses } from "./dq-xml/read";
export { updateDqAnalysis } from "./dq-xml/update";
export { duplicateDqAnalysis } from "./dq-xml/duplicate";
export type { DQIndicator, DqAnalysis, DqAnalysisMetadataUpdate } from "./dq-xml/types";
