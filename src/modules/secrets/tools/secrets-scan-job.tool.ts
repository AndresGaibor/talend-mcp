import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { ScanJobSecretsUseCase } from "../application/scan-job-secrets.usecase";
import { TalendSecretScannerAdapter } from "../adapters/talend-secret-scanner.adapter";
import { TalendJobRepositoryAdapter } from "../adapters/talend-job-repository.adapter";

export function createSecretsScanJobTool() {
  const jobRepo = new TalendJobRepositoryAdapter();
  const scanner = new TalendSecretScannerAdapter();
  const useCase = new ScanJobSecretsUseCase(jobRepo, scanner);

  return {
    name: "talend_secrets_scan_job",
    description: "Escanea un job específico en busca de secretos expuestos.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta del proyecto Talend",
        },
        jobName: {
          type: "string",
          description: "Nombre del job a escanear",
        },
      },
      required: ["projectPath", "jobName"],
    },
    handler: async (input: { projectPath: string; jobName: string }) => {
      try {
        const result = await useCase.execute(input.projectPath, input.jobName);
        return okResult(result, "secrets-scan-job");
      } catch (err) {
        return errorResult(
          "secrets-scan-job",
          "SCAN_JOB_ERROR",
          `Error escaneando job: ${err}`
        );
      }
    },
  };
}
