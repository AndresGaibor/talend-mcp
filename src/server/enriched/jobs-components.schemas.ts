import { z } from "zod/v4";
import {
  MapperEntrySchema,
  ParsedJobSchema,
  SchemaIssueSchema,
  TalendColumnSchema,
  TalendComponentSchema,
  TalendConnectionSchema,
  TalendContextParameterSchema,
} from "./base-schemas";

export const jobsAndComponentsSchemas: Record<string, z.ZodTypeAny> = {
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
      version: z.string().optional(),
      path: z.string(),
      folder: z.string().optional(),
      modified: z.string(),
      size: z.number(),
      components: z.number().optional(),
    })),
    count: z.number().optional(),
    total: z.number().optional(),
  }),
  talend_move_job_to_folder: z.object({
    moved: z.boolean(),
    jobName: z.string(),
    newPath: z.string(),
  }),
  talend_read_contexts: z.object({
    jobName: z.string().optional(),
    contexts: z.array(z.object({
      name: z.string(),
      type: z.string().optional(),
      value: z.string().optional(),
      prompt: z.string().optional(),
    })),
    count: z.number().optional(),
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
};
