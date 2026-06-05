import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { SuggestContextMigrationUseCase } from "../application/suggest-context-migration.usecase";
import { TalendJobRepositoryAdapter } from "../adapters/talend-job-repository.adapter";

export function createSecretsSuggestContextMigrationTool() {
  const jobRepo = new TalendJobRepositoryAdapter();
  const useCase = new SuggestContextMigrationUseCase(jobRepo);

  return {
    name: "talend_secrets_suggest_context_migration",
    description: "Sugiere cómo migrar secretos hardcoded a context profiles.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta del proyecto Talend",
        },
        jobName: {
          type: "string",
          description: "Nombre del job",
        },
      },
      required: ["projectPath", "jobName"],
    },
    handler: async (input: { projectPath: string; jobName: string }) => {
      try {
        const result = await useCase.execute(input.projectPath, input.jobName);
        return okResult(result, "secrets-suggest-context-migration");
      } catch (err) {
        return errorResult(
          "secrets-suggest-context-migration",
          "SUGGEST_MIGRATION_ERROR",
          `Error sugiriendo migración: ${err}`
        );
      }
    },
  };
}
