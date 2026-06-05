import { z } from "zod/v4";

// ─── Shared Base Schemas ──────────────────────────────────────────────────────

export const TalendColumnSchema = z.object({
  name: z.string().describe("Name of the column"),
  type: z.string().optional().describe("Java/Talend type of the column"),
  length: z.number().optional().describe("Length of the column"),
  precision: z.number().optional().describe("Precision of the column"),
  nullable: z.boolean().optional().describe("Whether the column is nullable"),
  key: z.boolean().optional().describe("Whether the column is part of the primary key"),
  sourceType: z.string().optional().describe("Source type"),
  pattern: z.string().optional().describe("Date or custom pattern"),
});

export const TalendSchemaSchema = z.object({
  connector: z.string().optional().describe("Connector name"),
  name: z.string().optional().describe("Name of the schema"),
  label: z.string().optional().describe("Label of the schema"),
  columns: z.array(TalendColumnSchema).describe("List of columns in this schema"),
});

export const TalendComponentSchema = z.object({
  uniqueName: z.string().describe("Unique identifier of the component in the job"),
  componentName: z.string().describe("Talend component type (e.g., tMysqlInput, tLogRow)"),
  label: z.string().optional().describe("Display label"),
  nodeAttributes: z.record(z.string(), z.string()).describe("Raw node attributes"),
  parameters: z.record(z.string(), z.string()).describe("Component parameters and values"),
  schemas: z.array(TalendSchemaSchema).describe("Associated schemas"),
  rawNodeData: z.unknown().optional(),
});

export const TalendConnectionSchema = z.object({
  connectorName: z.string().optional(),
  label: z.string().optional(),
  metaname: z.string().optional(),
  source: z.string().describe("Source component unique name"),
  target: z.string().describe("Target component unique name"),
  uniqueName: z.string().optional(),
});

export const TalendContextParameterSchema = z.object({
  name: z.string().describe("Parameter name"),
  type: z.string().optional().describe("Type of parameter (e.g. id_String)"),
  value: z.string().optional().describe("Parameter value"),
  prompt: z.string().optional().describe("UI prompt text"),
});

export const MapperEntrySchema = z.object({
  table: z.string().describe("Table name"),
  name: z.string().describe("Entry name"),
  expression: z.string().optional().describe("Mapping expression"),
  type: z.string().optional().describe("Type"),
  nullable: z.boolean().optional().describe("Nullable flag"),
});

export const ParsedJobSchema = z.object({
  itemPath: z.string().describe("Absolute file path to the job .item file"),
  components: z.array(TalendComponentSchema).describe("List of components in the job"),
  connections: z.array(TalendConnectionSchema).describe("Connections between components"),
  contexts: z.array(TalendContextParameterSchema).describe("Context parameters defined in the job"),
  mapperEntries: z.array(MapperEntrySchema).describe("Mapper entries for tMap/tXMLMap components"),
});

export const SchemaIssueSchema = z.object({
  component: z.string().describe("Component name with the schema issue"),
  schema: z.string().optional(),
  column: z.string().optional(),
  issue: z.enum(["empty-column-name", "null-column-name"]),
});

export const RepositoryContextSchema = z.object({
  name: z.string().describe("Context group name"),
  parameters: z.array(TalendContextParameterSchema).describe("Context parameters in this group"),
});

export const DQIndicatorSchema = z.object({
  name: z.string(),
  type: z.string(),
  computed: z.boolean(),
  count: z.number().optional(),
  length: z.number().optional(),
  distinctValueCount: z.number().optional(),
  valueToFreq: z.string().optional(),
  analyzedElement: z.string(),
});

export const DqAnalysisSchema = z.object({
  name: z.string(),
  status: z.string(),
  purpose: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  defaultContext: z.string(),
  lastRunOk: z.boolean(),
  lastRunDate: z.string().optional(),
  lastRunDuration: z.number().optional(),
  connectionName: z.string(),
  connectionPath: z.string(),
  columnCount: z.number(),
  analyzedColumns: z.array(z.string()),
  indicators: z.array(DQIndicatorSchema),
  filePath: z.string(),
});

export const ExportedJobScriptSchema = z.object({
  jobName: z.string(),
  scriptPath: z.string(),
  platform: z.enum(["windows", "posix"]),
  folderPath: z.string(),
  modifiedAt: z.string(),
  detectedVersion: z.string().optional(),
});

export const RunHistoryEntrySchema = z.object({
  runId: z.string(),
  jobName: z.string(),
  scriptPath: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  status: z.enum(["running", "success", "error", "timeout", "killed"]),
  exitCode: z.number().nullable().optional(),
  durationMs: z.number().optional(),
  stdoutPath: z.string(),
  stderrPath: z.string(),
  metadataPath: z.string(),
});

// ─── Enriched Tool Data Schema Mapping ────────────────────────────────────────

const ENRICHED_DATA_SCHEMAS: Record<string, z.ZodTypeAny | undefined> = {
  // ─── Execution ───
  talend_find_exported_jobs: z.array(ExportedJobScriptSchema),
  talend_job_info: z.object({
    itemPath: z.string(),
    propertiesPath: z.string(),
    scriptPath: z.string(),
    exists: z.boolean(),
  }),
  talend_list_runs: z.array(RunHistoryEntrySchema),
  talend_read_run: RunHistoryEntrySchema,
  talend_tail_run_output: z.object({
    stdout: z.string().optional(),
    stderr: z.string().optional(),
  }),
  talend_run_exported_job: z.object({
    ok: z.boolean(),
    source: z.enum(["exported-job-script", "unknown"]),
    confidence: z.enum(["high", "low"]),
    runId: z.string(),
    jobName: z.string(),
    scriptPath: z.string(),
    exitCode: z.number().nullable(),
    durationMs: z.number(),
    stdoutTail: z.string(),
    stderrTail: z.string(),
    logPath: z.string(),
    error: z.string().optional(),
  }),
  talend_run_job: z.object({
    ok: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().nullable(),
    durationMs: z.number(),
    error: z.string().optional(),
  }),

  // ─── Studio & Live ───
  talend_studio_process: z.object({
    running: z.boolean(),
    confidence: z.enum(["high", "medium", "low", "none"]),
    source: z.enum(["unknown", "filesystem", "workbench-xmi", "metadata-log", "launch-config", "exported-job-script", "studio-bridge", "process"]),
    processes: z.array(z.object({
      pid: z.number(),
      name: z.string(),
      command: z.string(),
      matchedBy: z.string(),
    })).optional(),
  }),
  talend_diagnose_environment: z.object({
    report: z.object({
      platform: z.object({
        runtimeOs: z.string(),
        talendHostOs: z.string(),
        pathMode: z.string(),
        isWsl: z.boolean(),
        nodeVersion: z.string(),
        cwd: z.string(),
      }),
      env: z.record(z.string(), z.string().optional()),
      paths: z.object({
        TALEND_PROJECT: z.object({ raw: z.string().optional(), mcp: z.string().optional(), talendHost: z.string().optional() }),
        TALEND_WORKSPACE: z.object({ raw: z.string().optional(), mcp: z.string().optional(), talendHost: z.string().optional() }),
        TALEND_STUDIO_HOME: z.object({ raw: z.string().optional(), mcp: z.string().optional(), talendHost: z.string().optional() }),
        TALEND_STUDIO_PLUGINS_DIR: z.object({ raw: z.string().optional(), mcp: z.string().optional(), talendHost: z.string().optional() }),
        TALEND_BUILDS_DIR: z.object({ raw: z.string().optional(), mcp: z.string().optional(), talendHost: z.string().optional() }),
      }),
    }),
  }),
  talend_list_launch_configs: z.object({
    configs: z.array(z.object({
      path: z.string(),
      currentProjectName: z.string().optional(),
      jobProjectTechLabel: z.string().optional(),
      jobId: z.string().optional(),
      jobName: z.string().optional(),
      jobVersion: z.string().optional(),
    })),
    count: z.number(),
  }),
  talend_list_open_editors: z.object({
    windows: z.array(z.any()),
  }),
  talend_get_probable_active_job: z.object({
    jobName: z.string().optional(),
    error: z.string().optional(),
    nextSteps: z.array(z.string()).optional(),
  }),
  talend_latest_changes: z.object({
    startedAt: z.string(),
    workspacePath: z.string().optional(),
    projectPath: z.string().optional(),
    projectName: z.string().optional(),
    lastFileChange: z.object({
      path: z.string(),
      event: z.enum(["created", "modified", "deleted", "unknown"]),
      at: z.string(),
    }).optional(),
    probableOpenJob: z.object({
      jobName: z.string(),
      source: z.enum(["workbench-xmi", "studio-bridge"]),
      confidence: z.enum(["high", "medium", "low", "none"]),
      detectedAt: z.string(),
    }).optional(),
    lastRun: RunHistoryEntrySchema.optional(),
    lastStudioError: z.object({
      message: z.string(),
      source: z.literal("metadata-log"),
      detectedAt: z.string(),
      snippet: z.string().optional(),
    }).optional(),
    warnings: z.array(z.string()),
  }),
  talend_live_start: z.object({
    watchedPaths: z.array(z.string()),
  }),
  talend_live_status: z.object({
    active: z.boolean(),
    startedAt: z.string().optional(),
    projectPath: z.string().optional(),
    projectName: z.string().optional(),
    lastChange: z.object({
      path: z.string(),
      event: z.enum(["created", "modified", "deleted", "unknown"]),
      at: z.string(),
    }).optional(),
    warnings: z.array(z.string()),
  }),
  talend_live_stop: z.object({
    stopped: z.boolean(),
  }),

  // ─── Analysis ───
  talend_analyze_logs: z.object({
    logFile: z.object({
      path: z.string(),
      size: z.number(),
      modified: z.string(),
    }).nullable(),
    analysis: z.object({
      jobName: z.string(),
      status: z.enum(["success", "failed", "unknown"]),
      latestCommand: z.object({ timestamp: z.string().optional(), line: z.number(), message: z.string() }).optional(),
      latestError: z.object({ timestamp: z.string().optional(), line: z.number(), message: z.string() }).optional(),
      errors: z.array(z.object({ timestamp: z.string().optional(), line: z.number(), message: z.string() })),
    }).nullable(),
    rawSnippet: z.array(z.string()),
    suggestions: z.array(z.string()),
  }),
  talend_analyze_tdboutput: z.object({
    tdbOutputs: z.array(z.object({
      componentName: z.string(),
      uniqueName: z.string(),
      host: z.string().optional(),
      port: z.string().optional(),
      dbName: z.string().optional(),
      user: z.string().optional(),
      table: z.string().optional(),
      tableAction: z.string().optional(),
      dataAction: z.string().optional(),
      batchSize: z.string().optional(),
      schema: z.string().optional(),
    })),
    count: z.number(),
  }),
  talend_duplicate_analysis: z.object({
    duplicated: z.boolean(),
    anaPath: z.string(),
    propertiesPath: z.string(),
  }),
  talend_full_analysis: z.object({
    analysis: z.object({
      jobName: z.string(),
      itemPath: z.string(),
      components: z.array(z.object({ name: z.string(), type: z.string(), label: z.string().optional(), posX: z.number(), posY: z.number() })),
      connections: z.array(z.object({ source: z.string(), target: z.string(), label: z.string().optional() })),
      tdbOutputs: z.array(z.object({ uniqueName: z.string(), componentName: z.string(), host: z.string().optional(), dbName: z.string().optional(), table: z.string().optional(), tableAction: z.string().optional(), dataAction: z.string().optional(), schemaColumns: z.number() })),
      contexts: z.array(z.object({ name: z.string(), type: z.string().optional(), value: z.string().optional() })),
      schemaIssues: z.array(SchemaIssueSchema),
      columnAnalysis: z.object({
        totalColumns: z.number(),
        analyzedColumns: z.number(),
        critical: z.number(),
        warnings: z.number(),
        infos: z.number(),
        byComponent: z.record(z.string(), z.number()),
        byType: z.record(z.string(), z.number()),
      }),
      stats: z.object({
        componentCount: z.number(),
        connectionCount: z.number(),
        contextCount: z.number(),
        tdbOutputCount: z.number(),
        schemaIssueCount: z.number(),
      }),
      issues: z.array(z.object({ type: z.string(), column: z.string(), severity: z.string() })),
      summary: z.string(),
    }),
  }),
  talend_inspect_component: z.object({
    inspection: z.object({
      component: TalendComponentSchema,
      incomingConnections: z.array(TalendConnectionSchema),
      outgoingConnections: z.array(TalendConnectionSchema),
      raw: z.object({ nodeAttributes: z.record(z.string(), z.string()) }).optional(),
    }),
  }),
  talend_inspect_job: z.object({
    inspection: z.object({
      job: ParsedJobSchema,
      components: z.array(z.any()),
      connections: z.array(TalendConnectionSchema),
      contexts: z.array(TalendContextParameterSchema),
      mapperEntries: z.array(MapperEntrySchema),
      schemaIssues: z.array(SchemaIssueSchema),
      stats: z.object({
        componentCount: z.number(),
        connectionCount: z.number(),
        contextCount: z.number(),
        mapperEntryCount: z.number(),
        schemaIssueCount: z.number(),
      }),
    }),
  }),
  talend_list_analyses: z.object({
    analyses: z.array(DqAnalysisSchema),
    count: z.number(),
  }),
  talend_read_analysis: z.object({
    analysis: DqAnalysisSchema,
  }),
  talend_read_run_log: z.object({
    runLog: z.object({
      jobName: z.string(),
      status: z.enum(["success", "failed", "unknown"]),
      errors: z.array(z.any()),
    }),
  }),
  talend_update_analysis: z.object({
    updated: z.boolean(),
    analysisPath: z.string(),
  }),
  talend_view_logs: z.object({
    lines: z.array(z.string()),
    formatted: z.string(),
    totalLines: z.number(),
    truncated: z.boolean(),
  }),

  // ─── Jobs ───
  talend_analyze_talend_job: z.object({
    analysis: ParsedJobSchema,
  }),
  talend_create_folder: z.object({
    folderPath: z.string(),
    directoryPath: z.string(),
  }),
  talend_create_job: z.object({
    jobName: z.string(),
    itemPath: z.string(),
    propertiesPath: z.string(),
  }),
  talend_delete_job: z.object({
    deleted: z.boolean(),
    jobName: z.string(),
  }),
  talend_duplicate_job: z.object({
    duplicated: z.boolean(),
    jobName: z.string(),
    newJobPath: z.string(),
  }),
  talend_list_components: z.object({
    components: z.array(z.string()),
    count: z.number(),
  }),
  talend_list_jobs: z.object({
    jobs: z.array(z.object({
      name: z.string(),
      path: z.string(),
      modified: z.string(),
      size: z.number(),
    })),
  }),
  talend_move_job_to_folder: z.object({
    moved: z.boolean(),
    jobName: z.string(),
    newPath: z.string(),
  }),
  talend_read_contexts: z.object({
    contexts: z.array(z.object({
      name: z.string(),
      type: z.string(),
      value: z.string(),
      source: z.string(),
    })),
  }),
  talend_read_job: z.object({
    job: ParsedJobSchema,
  }),
  talend_rename_job: z.object({
    renamed: z.boolean(),
    oldName: z.string(),
    newName: z.string(),
  }),
  talend_show_flow: z.object({
    flow: z.string(),
  }),

  // ─── Components ───
  talend_add_connection: z.object({
    itemPath: z.string(),
    sourceUniqueName: z.string(),
    targetUniqueName: z.string(),
    uniqueName: z.string(),
  }),
  talend_delete_component: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    deleted: z.boolean(),
  }),
  talend_delete_connection: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    deleted: z.boolean(),
  }),
  talend_duplicate_component: z.object({
    itemPath: z.string(),
    sourceUniqueName: z.string(),
    newUniqueName: z.string(),
    posX: z.number(),
    posY: z.number(),
  }),
  talend_move_component: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    posX: z.number(),
    posY: z.number(),
  }),
  talend_patch_component: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    updated: z.boolean(),
  }),
  talend_preview_delete_component: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    affectedConnections: z.array(z.string()),
  }),
  talend_preview_delete_connection: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    affectedConnections: z.array(z.string()),
  }),
  talend_preview_component_parameter: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    parameterName: z.string(),
    oldValue: z.string().nullable().optional(),
    newValue: z.string().nullable().optional(),
  }),
  talend_preview_schema_column: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    columnName: z.string(),
    oldValue: z.string().nullable().optional(),
    newValue: z.string().nullable().optional(),
  }),
  talend_update_component_parameter: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    parameterName: z.string(),
    value: z.string(),
  }),
  talend_update_schema_column: z.object({
    itemPath: z.string(),
    uniqueName: z.string(),
    columnName: z.string(),
    column: TalendColumnSchema.partial(),
  }),

  // ─── Contexts ───
  talend_create_repository_context: z.object({
    created: z.boolean(),
    name: z.string(),
  }),
  talend_delete_repository_context: z.object({
    deleted: z.boolean(),
    name: z.string(),
  }),
  talend_delete_repository_context_parameter: z.object({
    deleted: z.boolean(),
    contextName: z.string(),
    parameterName: z.string(),
  }),
  talend_list_project_contexts: z.object({
    contexts: z.array(z.string()),
  }),
  talend_list_repository_contexts: z.object({
    contexts: z.array(RepositoryContextSchema),
  }),
  talend_read_repository_context: z.object({
    context: RepositoryContextSchema,
  }),
  talend_upsert_repository_context_parameter: z.object({
    name: z.string(),
    parameter: z.object({
      name: z.string(),
      type: z.string(),
      value: z.string(),
    }),
  }),

  // ─── Repo ───
  talend_repo_pull: z.object({
    pulled: z.boolean(),
    output: z.string(),
  }),
  talend_repo_setup: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  talend_repo_sources: z.object({
    sources: z.array(z.string()),
  }),
  talend_repo_status: z.object({
    branch: z.string(),
    commit: z.string(),
    remote: z.string(),
    project: z.string().nullable(),
  }),
  talend_repo_switch: z.object({
    switched: z.boolean(),
    branch: z.string(),
  }),

  // ─── Secrets Module ───
  talend_secrets_scan_project: z.object({
    filesScannedCount: z.number().describe("Number of files scanned"),
    secretsFoundCount: z.number().describe("Number of secrets found"),
    findings: z.array(z.object({
      filePath: z.string(),
      jobName: z.string(),
      componentName: z.string().optional(),
      parameterName: z.string().optional(),
      secretValue: z.string(),
      type: z.string().optional(),
    })),
  }),
  talend_secrets_scan_job: z.object({
    jobName: z.string(),
    secretsFoundCount: z.number(),
    findings: z.array(z.object({
      componentName: z.string().optional(),
      parameterName: z.string().optional(),
      secretValue: z.string(),
      type: z.string().optional(),
    })),
  }),
  talend_secrets_suggest_context_migration: z.object({
    jobName: z.string(),
    suggestions: z.array(z.object({
      componentName: z.string(),
      parameterName: z.string(),
      currentValue: z.string(),
      suggestedContextParamName: z.string(),
    })),
  }),

  // ─── Snapshots Module ───
  talend_snapshots_list: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    tags: z.array(z.string()).optional(),
  })),
  talend_snapshots_create: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  talend_snapshots_diff: z.object({
    changes: z.array(z.object({
      filePath: z.string(),
      changeType: z.enum(["created", "modified", "deleted"]),
    })),
  }),
  talend_snapshots_restore: z.object({
    restored: z.boolean(),
    snapshotId: z.string(),
  }),
  talend_snapshots_read: z.object({
    snapshotId: z.string(),
    files: z.array(z.string()),
  }),

  // ─── Datasets Module ───
  talend_datasets_inspect_csv_folder: z.object({
    folderPath: z.string(),
    files: z.array(z.object({
      relativePath: z.string(),
      sizeBytes: z.number(),
      lineCount: z.number().optional(),
    })),
    totalRows: z.number(),
  }),
  talend_datasets_infer_csv_schema: z.object({
    csvFile: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({
      csvColumn: z.string(),
      dbColumn: z.string(),
      dbType: z.string(),
      nullable: z.boolean(),
      sampleValues: z.array(z.string()).optional(),
    })),
  }),
  talend_datasets_generate_raw_mappings: z.object({
    folderPath: z.string(),
    mappings: z.array(z.object({
      csvFile: z.string(),
      targetTable: z.string(),
      columns: z.array(z.object({
        source: z.string(),
        target: z.string(),
        talendType: z.string(),
        nullable: z.boolean(),
      })),
      technicalColumns: z.array(z.object({
        name: z.string(),
        expression: z.string(),
      })),
    })),
    csvFileCount: z.number(),
    totalRows: z.number(),
  }),

  // ─── Deliverables Module ───
  talend_deliverables_export_job: z.object({
    exportedZipPath: z.string(),
    jobName: z.string(),
    version: z.string(),
  }),
  talend_deliverables_collect: z.object({
    collectedFiles: z.array(z.string()),
    destinationDir: z.string(),
  }),
  talend_deliverables_validate: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  talend_deliverables_create_package: z.object({
    packagePath: z.string(),
    contents: z.array(z.string()),
  }),

  // ─── Errors Module ───
  talend_errors_explain: z.object({
    explanation: z.string(),
    probableCause: z.string(),
    component: z.string().optional(),
  }),
  talend_errors_suggest_fix: z.object({
    suggestions: z.array(z.string()),
    codeSnippet: z.string().optional(),
  }),
  talend_errors_stats: z.object({
    totalErrors: z.number(),
    errorsByType: z.record(z.string(), z.number()),
  }),

  // ─── Validation Module ───
  talend_validation_validate_design: z.object({
    score: z.number().describe("0-100 design score"),
    issues: z.array(z.object({
      componentName: z.string().optional(),
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
    })),
  }),
  talend_validation_validate_context_usage: z.object({
    issues: z.array(z.object({
      message: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    })),
  }),
  talend_validation_validate_audit_columns: z.object({
    compliant: z.boolean(),
    missingColumns: z.array(z.string()),
  }),
  talend_validation_validate_performance: z.object({
    score: z.number(),
    recommendations: z.array(z.string()),
  }),
};

// ─── Missing Schemas ───
ENRICHED_DATA_SCHEMAS.talend_detect_open_jobs = z.object({
  jobs: z.array(z.object({
    jobName: z.string(),
    version: z.string(),
    label: z.string(),
    workbenchPath: z.string(),
  })),
  count: z.number(),
  message: z.string().optional(),
});

ENRICHED_DATA_SCHEMAS.talend_summarize_open_job = z.object({
  summary: z.object({
    jobName: z.string(),
    version: z.string().optional(),
    label: z.string().optional(),
    activeEditor: z.string().optional(),
    probableType: z.string().optional(),
    launchConfig: z.any().nullable(),
    workbenchPath: z.string(),
    metadataPath: z.string(),
  }).nullable(),
  message: z.string().optional(),
});

// ─── Alias Assignments ───
ENRICHED_DATA_SCHEMAS.talend_jobs_list = ENRICHED_DATA_SCHEMAS.talend_list_jobs;
ENRICHED_DATA_SCHEMAS.talend_jobs_read = ENRICHED_DATA_SCHEMAS.talend_read_job;
ENRICHED_DATA_SCHEMAS.talend_runs_list = ENRICHED_DATA_SCHEMAS.talend_list_runs;
ENRICHED_DATA_SCHEMAS.talend_runs_read = ENRICHED_DATA_SCHEMAS.talend_read_run;
ENRICHED_DATA_SCHEMAS.talend_runs_start = ENRICHED_DATA_SCHEMAS.talend_run_job;
ENRICHED_DATA_SCHEMAS.talend_runs_start_exported = ENRICHED_DATA_SCHEMAS.talend_run_exported_job;
ENRICHED_DATA_SCHEMAS.talend_job_run_by_name = ENRICHED_DATA_SCHEMAS.talend_run_job;
ENRICHED_DATA_SCHEMAS.talend_diagnose_job = ENRICHED_DATA_SCHEMAS.talend_diagnose_environment;
ENRICHED_DATA_SCHEMAS.talend_secret_scan_project = ENRICHED_DATA_SCHEMAS.talend_secrets_scan_project;
ENRICHED_DATA_SCHEMAS.talend_secret_scan_job = ENRICHED_DATA_SCHEMAS.talend_secrets_scan_job;
ENRICHED_DATA_SCHEMAS.talend_secret_suggest_context_migration = ENRICHED_DATA_SCHEMAS.talend_secrets_suggest_context_migration;
ENRICHED_DATA_SCHEMAS.talend_snapshot_list = ENRICHED_DATA_SCHEMAS.talend_snapshots_list;
ENRICHED_DATA_SCHEMAS.talend_snapshot_create = ENRICHED_DATA_SCHEMAS.talend_snapshots_create;
ENRICHED_DATA_SCHEMAS.talend_snapshot_diff = ENRICHED_DATA_SCHEMAS.talend_snapshots_diff;
ENRICHED_DATA_SCHEMAS.talend_snapshot_restore = ENRICHED_DATA_SCHEMAS.talend_snapshots_restore;
ENRICHED_DATA_SCHEMAS.talend_snapshot_read = ENRICHED_DATA_SCHEMAS.talend_snapshots_read;
ENRICHED_DATA_SCHEMAS.talend_deliverable_export_job = ENRICHED_DATA_SCHEMAS.talend_deliverables_export_job;
ENRICHED_DATA_SCHEMAS.talend_deliverable_collect_files = ENRICHED_DATA_SCHEMAS.talend_deliverables_collect;
ENRICHED_DATA_SCHEMAS.talend_deliverable_create_package = ENRICHED_DATA_SCHEMAS.talend_deliverables_create_package;
ENRICHED_DATA_SCHEMAS.talend_deliverables_validate = ENRICHED_DATA_SCHEMAS.talend_deliverables_validate;
ENRICHED_DATA_SCHEMAS.talend_deliverable_validate_checklist = ENRICHED_DATA_SCHEMAS.talend_deliverables_validate;
ENRICHED_DATA_SCHEMAS.talend_dataset_inspect_csv_folder = ENRICHED_DATA_SCHEMAS.talend_datasets_inspect_csv_folder;
ENRICHED_DATA_SCHEMAS.talend_dataset_infer_csv_schema = ENRICHED_DATA_SCHEMAS.talend_datasets_infer_csv_schema;
ENRICHED_DATA_SCHEMAS.talend_dataset_generate_raw_table_mapping = ENRICHED_DATA_SCHEMAS.talend_datasets_generate_raw_mappings;
ENRICHED_DATA_SCHEMAS.talend_dataset_generate_raw_table_mappings = ENRICHED_DATA_SCHEMAS.talend_datasets_generate_raw_mappings;
ENRICHED_DATA_SCHEMAS.talend_error_explain = ENRICHED_DATA_SCHEMAS.talend_errors_explain;
ENRICHED_DATA_SCHEMAS.talend_error_suggest_fix = ENRICHED_DATA_SCHEMAS.talend_errors_suggest_fix;
ENRICHED_DATA_SCHEMAS.talend_error_stats = ENRICHED_DATA_SCHEMAS.talend_errors_stats;
ENRICHED_DATA_SCHEMAS.talend_job_validate_design = ENRICHED_DATA_SCHEMAS.talend_validation_validate_design;
ENRICHED_DATA_SCHEMAS.talend_job_validate_context_usage = ENRICHED_DATA_SCHEMAS.talend_validation_validate_context_usage;
ENRICHED_DATA_SCHEMAS.talend_job_validate_audit_columns = ENRICHED_DATA_SCHEMAS.talend_validation_validate_audit_columns;
ENRICHED_DATA_SCHEMAS.talend_job_validate_performance_settings = ENRICHED_DATA_SCHEMAS.talend_validation_validate_performance;
ENRICHED_DATA_SCHEMAS.talend_job_validate_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_validate_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_job_apply_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_apply_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_job_preview_pipeline_spec = ENRICHED_DATA_SCHEMAS.talend_jobs_preview_pipeline_spec;
ENRICHED_DATA_SCHEMAS.talend_report_snippet_get = ENRICHED_DATA_SCHEMAS.talend_report_snippets_list;
ENRICHED_DATA_SCHEMAS.talend_report_snippet_list = ENRICHED_DATA_SCHEMAS.talend_report_snippets_list;
ENRICHED_DATA_SCHEMAS.talend_report_generate_snippets = ENRICHED_DATA_SCHEMAS.talend_report_snippets_generate;


// ─── Helper Functions to construct output envelopes ──────────────────────────

/**
 * Checks if the tool has an enriched data schema registered.
 */
export function hasEnrichedDataSchema(toolName: string): boolean {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  return normName in ENRICHED_DATA_SCHEMAS;
}

/**
 * Gets the Zod output schema for the tool.
 * Depending on the result pattern, we wrap it in TalendResult or standard Pattern A.
 */
export function getEnrichedOutputSchema(toolName: string, pattern: "A" | "B" = "A"): z.ZodTypeAny {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  const dataSchema = ENRICHED_DATA_SCHEMAS[normName] ?? z.unknown();

  if (pattern === "B" || normName === "talend_diagnose_environment") {
    // Return the full TalendResult wrapper
    return z.object({
      ok: z.boolean().describe("Whether the operation succeeded"),
      source: z.string().describe("Tool name that produced this result"),
      confidence: z.enum(["high", "medium", "low", "none"]).describe("Confidence level of the result"),
      data: dataSchema.optional().describe("The result payload"),
      warnings: z.array(z.string()).optional().describe("Non-fatal warnings"),
      errors: z.array(
        z.object({
          code: z.string(),
          message: z.string(),
          details: z.record(z.string(), z.unknown()).optional(),
        })
      ).optional().describe("Errors if ok is false"),
      nextActions: z.array(
        z.object({
          label: z.string(),
          toolName: z.string(),
          input: z.record(z.string(), z.unknown()).optional(),
        })
      ).optional().describe("Suggested follow-up tool calls"),
    });
  }

  // Return the standard ok/fail envelope (Pattern A)
  return z.object({
    ok: z.boolean().describe("Whether the operation succeeded"),
    data: dataSchema.optional().describe("The result payload"),
    durationMs: z.number().optional().describe("Operation duration in milliseconds"),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }).optional().describe("Error payload if operation failed"),
  });
}
