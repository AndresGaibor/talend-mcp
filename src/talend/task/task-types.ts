export type ResponsabilidadTalend =
  | "crear_job"
  | "configurar_contextos"
  | "leer_archivos_csv"
  | "escribir_base_datos"
  | "configurar_componentes"
  | "ejecutar_job"
  | "medir_performance"
  | "exportar_job"
  | "configurar_audit_columns"
  | "configurar_batch_size"
  | "usar_contextos_parametricos";

export type ResponsabilidadExterna =
  | "diseñar_schema_stg"
  | "diseñar_schema_mart"
  | "validar_modelo_dimensional"
  | "definir_negocio_rules"
  | "proveer_credenciales_db"
  | "configurar_infraestructura";

export type PatrónTalend =
  | "multi_csv_raw_loader"
  | "csv_to_db_with_audit_columns"
  | "sql_orchestration_job"
  | "db_to_db_copy"
  | "api_to_db_loader"
  | "file_watcher_pipeline";

export type ToolSugerida =
  | "talend_dataset_inspect_csv_folder"
  | "talend_job_generate_from_pipeline_spec"
  | "talend_job_validate_design"
  | "talend_job_run_by_name"
  | "talend_deliverable_export_job"
  | "talend_context_profile_apply_to_job"
  | "talend_connection_build_profile";

export interface RequerimientoAnalizado {
  ok: boolean;
  talendResponsibilities: ResponsabilidadTalend[];
  externalResponsibilities: ResponsabilidadExterna[];
  patronesDetectados: PatrónTalend[];
  suggestedTools: ToolSugerida[];
  confidence: "low" | "medium" | "high";
  fragmentosRequerimiento?: Record<string, string>;
}

export interface AnálisisTareaInput {
  enunciado: string;
  contextoAdicional?: string;
}

export interface AnálisisTareaOutput extends RequerimientoAnalizado {
  rawPatternMatches: PatternMatch[];
  recommendations: string[];
}

export interface PatternMatch {
  pattern: string;
  matched: boolean;
  evidence: string;
  weight: number;
}
