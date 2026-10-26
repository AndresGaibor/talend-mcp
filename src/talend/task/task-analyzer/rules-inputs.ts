import type { PatternRule } from "./rule-types";

/** Entradas: lectura de archivos y carpetas, incluidos los disparadores por archivo. */
export const INPUT_RULES: PatternRule[] = [
  {
    pattern: "multi_csv_raw_loader",
    keywords: [
      "olist",
      "csv",
      "carregar",
      "cargar",
      "carga cruda",
      "carga raw",
      "carga",
      "raw",
      "leer múltiples",
      "archivos csv",
      "batch",
      "insertar en base",
      "less than 5 minutes",
      "menor a 5 minutos",
    ],
    talendResponsibilities: [
      "crear_job",
      "leer_archivos_csv",
      "configurar_audit_columns",
      "configurar_batch_size",
      "escribir_base_datos",
      "medir_performance",
      "exportar_job",
    ],
    externalResponsibilities: [
      "diseñar_schema_stg",
      "proveer_credenciales_db",
    ],
    suggestedTools: [
      "talend_dataset_inspect_csv_folder",
      "talend_job_generate_from_pipeline_spec",
      "talend_job_validate_design",
      "talend_job_run_by_name",
      "talend_deliverable_export_job",
    ],
    weight: 10,
  },
  {
    pattern: "file_watcher_pipeline",
    keywords: [
      "watcher",
      "monitorizar",
      "directorio",
      "archivo nuevo",
      "trigger on file",
    ],
    talendResponsibilities: [
      "crear_job",
      "leer_archivos_csv",
      "configurar_componentes",
      "ejecutar_job",
    ],
    externalResponsibilities: [
      "configurar_infraestructura",
    ],
    suggestedTools: [
      "talend_job_generate_from_pipeline_spec",
      "talend_job_validate_design",
    ],
    weight: 3,
  },
];
