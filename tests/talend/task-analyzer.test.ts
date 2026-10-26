import { describe, expect, test } from "bun:test";
import { analyzeTaskRequirements } from "../../src/talend/task/task-analyzer";

describe("analisis de requerimientos: caracterizacion", () => {
  test("detecta una carga de CSV multiples con confianza alta", () => {
    const result = analyzeTaskRequirements({
      enunciado: "Cargar archivos CSV de olist a staging en menos a 5 minutos",
    });

    expect(result.ok).toBe(true);
    expect(result.patronesDetectados).toContain("multi_csv_raw_loader");
    expect(result.confidence).toBe("high");
    expect(result.talendResponsibilities).toContain("leer_archivos_csv");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  test("detecta una copia de base a base", () => {
    const result = analyzeTaskRequirements({
      enunciado: "Copiar tablas de base a base",
    });

    expect(result.patronesDetectados).toEqual(["db_to_db_copy"]);
    expect(result.suggestedTools).toContain("talend_job_validate_design");
  });

  test("un enunciado sin patrones da confianza baja y ninguna recomendacion", () => {
    const result = analyzeTaskRequirements({ enunciado: "Revisar el correo" });

    expect(result.patronesDetectados).toEqual([]);
    expect(result.confidence).toBe("low");
    expect(result.recommendations).toEqual([]);
    expect(result.talendResponsibilities).toEqual([]);
  });

  test("mantiene el orden historico de las reglas", () => {
    const result = analyzeTaskRequirements({ enunciado: "sin coincidencias" });

    expect(result.rawPatternMatches.map((m) => m.pattern)).toEqual([
      "multi_csv_raw_loader",
      "csv_to_db_with_audit_columns",
      "db_to_db_copy",
      "sql_orchestration_job",
      "api_to_db_loader",
      "file_watcher_pipeline",
    ]);
    expect(result.rawPatternMatches.every((m) => !m.matched)).toBe(true);
  });
});
