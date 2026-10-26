import type { PatternRule } from "./rule-types";

/** Calidad: columnas tecnicas de auditoria y cargas incrementales. */
export const QUALITY_RULES: PatternRule[] = [
  {
    pattern: "csv_to_db_with_audit_columns",
    keywords: [
      "csv",
      "_load_ts",
      "_load_run",
      "audit columns",
      "columnas técnicas",
      "load timestamp",
      "load run id",
      "append",
      "no truncate",
    ],
    talendResponsibilities: [
      "crear_job",
      "leer_archivos_csv",
      "configurar_audit_columns",
      "escribir_base_datos",
      "usar_contextos_parametricos",
    ],
    externalResponsibilities: [
      "diseñar_schema_stg",
      "validar_modelo_dimensional",
    ],
    suggestedTools: [
      "talend_dataset_inspect_csv_folder",
      "talend_job_generate_from_pipeline_spec",
      "talend_context_profile_apply_to_job",
    ],
    weight: 8,
  },
];
