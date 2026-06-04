import type {
  AnálisisTareaInput,
  AnálisisTareaOutput,
  PatternMatch,
  PatrónTalend,
  ResponsabilidadExterna,
  ResponsabilidadTalend,
  ToolSugerida,
} from "./task-types";

const PATTERN_RULES: Array<{
  pattern: PatrónTalend;
  keywords: string[];
  talendResponsibilities: ResponsabilidadTalend[];
  externalResponsibilities: ResponsabilidadExterna[];
  suggestedTools: ToolSugerida[];
  weight: number;
}> = [
  {
    pattern: "multi_csv_raw_loader",
    keywords: [
      "olist",
      "csv",
      "carregar",
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
      "leer_archivos_csv",
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

function matchPattern(enunciado: string, rule: (typeof PATTERN_RULES)[number]): PatternMatch {
  const lower = enunciado.toLowerCase();
  const matchedKeywords = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const matched = matchedKeywords.length > 0;
  return {
    pattern: rule.pattern,
    matched,
    evidence: matched ? `Keywords matched: ${matchedKeywords.join(", ")}` : "No keywords matched",
    weight: matched ? rule.weight * matchedKeywords.length : 0,
  };
}

export function analyzeTaskRequirements(input: AnálisisTareaInput): AnálisisTareaOutput {
  const enunciado = input.enunciado.toLowerCase();

  const rawPatternMatches: PatternMatch[] = PATTERN_RULES.map((rule) =>
    matchPattern(input.enunciado, rule)
  );

  const sortedPatterns = [...rawPatternMatches]
    .filter((m) => m.matched)
    .sort((a, b) => b.weight - a.weight);

  const patronesDetectados = sortedPatterns.map((m) => m.pattern as PatrónTalend);

  const talendResponsibilitiesSet = new Set<ResponsabilidadTalend>();
  const externalResponsibilitiesSet = new Set<ResponsabilidadExterna>();
  const suggestedToolsSet = new Set<ToolSugerida>();

  for (const matched of sortedPatterns) {
    const rule = PATTERN_RULES.find((r) => r.pattern === matched.pattern);
    if (!rule) continue;

    for (const resp of rule.talendResponsibilities) {
      talendResponsibilitiesSet.add(resp);
    }
    for (const resp of rule.externalResponsibilities) {
      externalResponsibilitiesSet.add(resp);
    }
    for (const tool of rule.suggestedTools) {
      suggestedToolsSet.add(tool);
    }
  }

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

  let confidence: "low" | "medium" | "high" = "medium";
  const topPattern = sortedPatterns[0];
  if (sortedPatterns.length >= 2) {
    confidence = "high";
  } else if (sortedPatterns.length === 1 && topPattern && topPattern.weight >= 8) {
    confidence = "high";
  } else if (sortedPatterns.length === 0) {
    confidence = "low";
  }

  return {
    ok: true,
    talendResponsibilities: Array.from(talendResponsibilitiesSet),
    externalResponsibilities: Array.from(externalResponsibilitiesSet),
    patronesDetectados,
    suggestedTools: Array.from(suggestedToolsSet),
    confidence,
    rawPatternMatches,
    recommendations,
  };
}
