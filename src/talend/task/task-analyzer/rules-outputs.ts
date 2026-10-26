import type { PatternRule } from "./rule-types";

/** Salidas: cargas contra una base de datos. */
export const OUTPUT_RULES: PatternRule[] = [
  {
    pattern: "api_to_db_loader",
    keywords: [
      "api",
      "rest",
      "json",
      "http",
      "consumir servicio",
      "consumir api",
    ],
    talendResponsibilities: [
      "crear_job",
      "configurar_componentes",
      "escribir_base_datos",
      "usar_contextos_parametricos",
    ],
    externalResponsibilities: [
      "proveer_credenciales_db",
      "definir_negocio_rules",
    ],
    suggestedTools: [
      "talend_connection_build_profile",
      "talend_job_generate_from_pipeline_spec",
      "talend_deliverable_export_job",
    ],
    weight: 5,
  },
];
