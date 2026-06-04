import type { JobSpec, PipelineSpec, ValidationResult, JobSpecComponent, JobSpecContext } from "./job-spec-types";
import type { PatrónTalend } from "../task/task-types";

export const PIPELINE_PATTERNS: Record<PatrónTalend, {
  description: string;
  components: Omit<JobSpecComponent, "name" | "parameters">[];
  defaultContexts: Omit<JobSpecContext, "defaultValue">[];
  supportsAuditColumns: boolean;
  defaultBatchSize: number;
}> = {
  multi_csv_raw_loader: {
    description: "Carga múltiples archivos CSV a tabla raw con columnas técnicas de audit",
    components: [
      { componentName: "tFileInputDelimited", type: "input", connections: [{ to: "tMap" }] },
      { componentName: "tMap", type: "transform", connections: [{ from: "tFileInputDelimited", to: "tDBOutput" }] },
      { componentName: "tDBOutput", type: "output", connections: [] },
    ],
    defaultContexts: [
      { name: "input_path", type: "string" },
      { name: "batch_size", type: "number" },
      { name: "run_id", type: "string" },
      { name: "db_host", type: "string" },
      { name: "db_port", type: "string" },
      { name: "db_name", type: "string" },
      { name: "db_user", type: "string" },
    ],
    supportsAuditColumns: true,
    defaultBatchSize: 5000,
  },
  csv_to_db_with_audit_columns: {
    description: "Lee CSV y escribe a DB con columnas técnicas _load_ts y _load_run",
    components: [
      { componentName: "tFileInputDelimited", type: "input", connections: [{ to: "tMap" }] },
      { componentName: "tMap", type: "transform", connections: [{ from: "tFileInputDelimited", to: "tDBOutput" }] },
      { componentName: "tDBOutput", type: "output", connections: [] },
    ],
    defaultContexts: [
      { name: "input_path", type: "string" },
      { name: "batch_size", type: "number" },
      { name: "run_id", type: "string" },
    ],
    supportsAuditColumns: true,
    defaultBatchSize: 5000,
  },
  sql_orchestration_job: {
    description: "Orquesta múltiples jobs o procedimientos almacenados",
    components: [
      { componentName: "tRunJob", type: "orchestration", connections: [] },
    ],
    defaultContexts: [
      { name: "job_name", type: "string" },
      { name: "run_after", type: "string" },
    ],
    supportsAuditColumns: false,
    defaultBatchSize: 1,
  },
  db_to_db_copy: {
    description: "Copia datos de una base a otra",
    components: [
      { componentName: "tDBInput", type: "input", connections: [{ to: "tDBOutput" }] },
      { componentName: "tDBOutput", type: "output", connections: [] },
    ],
    defaultContexts: [
      { name: "source_db_host", type: "string" },
      { name: "target_db_host", type: "string" },
    ],
    supportsAuditColumns: false,
    defaultBatchSize: 1000,
  },
  api_to_db_loader: {
    description: "Consume API REST y escribe a base de datos",
    components: [
      { componentName: "tRestClient", type: "input", connections: [{ to: "tParseJson" }] },
      { componentName: "tParseJson", type: "transform", connections: [{ from: "tRestClient", to: "tDBOutput" }] },
      { componentName: "tDBOutput", type: "output", connections: [] },
    ],
    defaultContexts: [
      { name: "api_base_url", type: "string" },
      { name: "api_key", type: "password" },
      { name: "batch_size", type: "number" },
    ],
    supportsAuditColumns: true,
    defaultBatchSize: 1000,
  },
  file_watcher_pipeline: {
    description: "Monitoriza directorio y ejecuta job cuando aparece archivo nuevo",
    components: [
      { componentName: "tFileList", type: "iterator", connections: [{ to: "tFileInputDelimited" }] },
      { componentName: "tFileInputDelimited", type: "input", connections: [{ to: "tDBOutput" }] },
      { componentName: "tDBOutput", type: "output", connections: [] },
    ],
    defaultContexts: [
      { name: "watch_path", type: "string" },
      { name: "file_pattern", type: "string" },
    ],
    supportsAuditColumns: true,
    defaultBatchSize: 5000,
  },
};

export function generateJobSpec(pattern: PatrónTalend, name: string, options?: {
  inputPath?: string;
  outputTable?: string;
  batchSize?: number;
  auditColumns?: boolean;
}): JobSpec {
  const patternDef = PIPELINE_PATTERNS[pattern];
  if (!patternDef) {
    throw new Error(`Patrón no soportado: ${pattern}`);
  }

  const components: JobSpecComponent[] = patternDef.components.map((c, i) => ({
    name: `${c.componentName}_${i + 1}`,
    componentName: c.componentName,
    type: c.type,
    connections: c.connections,
    parameters: {},
  }));

  const contexts: JobSpecContext[] = patternDef.defaultContexts.map((c) => ({
    name: c.name,
    type: c.type as JobSpecContext["type"],
    defaultValue: c.name === "batch_size" ? String(patternDef.defaultBatchSize) : "",
  }));

  return {
    jobName: name,
    pattern,
    description: patternDef.description,
    components,
    contexts,
    inputPath: options?.inputPath,
    outputTable: options?.outputTable,
    batchSize: options?.batchSize ?? patternDef.defaultBatchSize,
    appendMode: true,
    auditColumns: options?.auditColumns ?? patternDef.supportsAuditColumns,
    technicalColumns: patternDef.supportsAuditColumns
      ? [
          { name: "_load_ts", value: "TalendDate.getCurrentDate()" },
          { name: "_load_run", value: "context.run_id" },
        ]
      : undefined,
  };
}

export function validateJobSpec(spec: JobSpec): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  if (!spec.jobName || spec.jobName.trim() === "") {
    errors.push({ code: "EMPTY_JOB_NAME", message: "El nombre del job no puede estar vacío" });
  }

  if (!spec.pattern) {
    errors.push({ code: "NO_PATTERN", message: "El job debe tener un patrón asociado" });
  }

  if (!spec.components || spec.components.length === 0) {
    errors.push({ code: "NO_COMPONENTS", message: "El job debe tener al menos un componente" });
  }

  if (spec.auditColumns) {
    const hasTechnicalColumns = spec.technicalColumns && spec.technicalColumns.length > 0;
    if (!hasTechnicalColumns) {
      warnings.push({
        code: "AUDIT_WITHOUT_COLUMNS",
        message: "auditColumns=true pero no se definieron technicalColumns",
      });
    }
  }

  if (spec.batchSize && spec.batchSize > 10000) {
    warnings.push({
      code: "LARGE_BATCH_SIZE",
      message: `Batch size ${spec.batchSize} es mayor a 10000, revisar performance`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
