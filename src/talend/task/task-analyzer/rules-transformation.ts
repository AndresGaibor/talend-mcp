import type { PatternRule } from "./rule-types";

/** Transformación: copia de datos entre bases. */
export const TRANSFORMATION_RULES: PatternRule[] = [
  {
    pattern: "db_to_db_copy",
    keywords: [
      "base a base",
      "database to database",
      "copiar tablas",
      "migrar datos",
      "extract load",
      "etl",
    ],
    talendResponsibilities: [
      "crear_job",
      "leer_base_datos",
      "escribir_base_datos",
      "configurar_componentes",
    ],
    externalResponsibilities: [
      "diseñar_schema_stg",
      "proveer_credenciales_db",
    ],
    suggestedTools: [
      "talend_connection_build_profile",
      "talend_job_generate_from_pipeline_spec",
      "talend_job_validate_design",
    ],
    weight: 6,
  },
];
