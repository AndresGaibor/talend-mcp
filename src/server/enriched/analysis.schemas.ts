import { z } from "zod/v4";
import {
  DqAnalysisSchema,
  MapperEntrySchema,
  ParsedJobSchema,
  SchemaIssueSchema,
  TalendComponentSchema,
  TalendConnectionSchema,
  TalendContextParameterSchema,
} from "./base-schemas";

export const analysisSchemas: Record<string, z.ZodTypeAny> = {
  talend_analyze_logs: z.object({
    logFile: z.object({ path: z.string(), size: z.number(), modified: z.string() }).nullable(),
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
  talend_duplicate_analysis: z.object({ duplicated: z.boolean(), anaPath: z.string(), propertiesPath: z.string() }),
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
  talend_list_analyses: z.object({ analyses: z.array(DqAnalysisSchema), count: z.number() }),
  talend_read_analysis: z.object({ analysis: DqAnalysisSchema }),
  talend_read_run_log: z.object({
    runLog: z.object({
      jobName: z.string(),
      status: z.enum(["success", "failed", "unknown"]),
      errors: z.array(z.any()),
    }),
  }),
  talend_update_analysis: z.object({ updated: z.boolean(), analysisPath: z.string() }),
  talend_view_logs: z.object({ lines: z.array(z.string()), formatted: z.string(), totalLines: z.number(), truncated: z.boolean() }),
};
