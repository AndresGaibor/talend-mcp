import { z } from "zod/v4";
import { RepositoryContextSchema } from "./base-schemas";

export const contextsRepositorySchemas: Record<string, z.ZodTypeAny> = {
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
  talend_list_repository_connections: z.object({
    count: z.number(),
    connections: z.array(z.object({
      name: z.string().nullable(),
      version: z.string().nullable(),
      itemType: z.string(),
      connectionType: z.string().nullable(),
    })),
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
  talend_repo_pull: z.object({
    pulled: z.boolean(),
    output: z.string(),
  }),
  talend_repo_setup: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  talend_repo_sources: z.object({
    repos: z.array(z.object({
      name: z.string().describe("Folder name inside the local cache"),
      source: z.string().describe("Original source; cached clones report cache:<name>"),
      path: z.string().describe("Local path of the cached repository"),
      branch: z.string().describe("Current branch"),
    })),
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
};
