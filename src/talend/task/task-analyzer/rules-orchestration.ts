import type { PatternRule } from "./rule-types";

/** Orquestación: procedimientos almacenados y jobs encadenados. */
export const ORCHESTRATION_RULES: PatternRule[] = [
  {
    pattern: "sql_orchestration_job",
    keywords: [
      "orquestación",
      "orchestration",
      "stored procedure",
      "procedimiento almacenado",
      "triggers",
      "jobs encadenados",
    ],
    talendResponsibilities: [
      "crear_job",
      "configurar_componentes",
      "ejecutar_job",
    ],
    externalResponsibilities: [
      "diseñar_schema_mart",
      "definir_negocio_rules",
    ],
    suggestedTools: [
      "talend_job_generate_from_pipeline_spec",
      "talend_job_run_by_name",
    ],
    weight: 5,
  },
];
