export * from "./domain/secret-finding.types";
export * from "./ports/job-repository.port";
export * from "./ports/file-system.port";
export * from "./adapters/talend-secret-scanner.adapter";
export * from "./adapters/talend-job-repository.adapter";
export * from "./application/scan-project-secrets.usecase";
export * from "./application/scan-job-secrets.usecase";
export * from "./application/suggest-context-migration.usecase";
export * from "./tools/secrets-scan-project.tool";
export * from "./tools/secrets-scan-job.tool";
export * from "./tools/secrets-suggest-context-migration.tool";

import { createSecretsScanProjectTool } from "./tools/secrets-scan-project.tool";
import { createSecretsScanJobTool } from "./tools/secrets-scan-job.tool";
import { createSecretsSuggestContextMigrationTool } from "./tools/secrets-suggest-context-migration.tool";

export const secretsTools = [
  createSecretsScanProjectTool(),
  createSecretsScanJobTool(),
  createSecretsSuggestContextMigrationTool(),
];
