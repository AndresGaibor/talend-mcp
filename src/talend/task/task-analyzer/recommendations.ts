import type { PatrónTalend } from "../task-types";

/** Recomendaciones de implementacion para los patrones detectados. */
export function buildRecommendations(patronesDetectados: PatrónTalend[]): string[] {
  const recommendations: string[] = [];
  if (patronesDetectados.includes("multi_csv_raw_loader")) {
    recommendations.push(
      "Considera usar tFileInputDelimited para leer CSVs múltiples con patrón glob",
      "Configura contextos: input_path, batch_size, run_id",
      "Agrega columnas técnicas _load_ts y _load_run",
      "Usa tDBOutput con batch size 5000 para performance",
      "Mide tiempo con Monitoring"
    );
  }
  return recommendations;
}
