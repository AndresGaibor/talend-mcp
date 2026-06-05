import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { ScanProjectSecretsUseCase } from "../application/scan-project-secrets.usecase";
import { TalendSecretScannerAdapter } from "../adapters/talend-secret-scanner.adapter";

export function createSecretsScanProjectTool() {
  const scanner = new TalendSecretScannerAdapter();
  const useCase = new ScanProjectSecretsUseCase(scanner);

  return {
    name: "talend_secrets_scan_project",
    description: "Escanea todo el proyecto en busca de secretos expuestos en archivos .item y .properties.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Ruta del proyecto Talend",
        },
      },
      required: ["projectPath"],
    },
    handler: async (input: { projectPath: string }) => {
      try {
        const result = await useCase.execute(input.projectPath);
        return okResult(result, "secrets-scan-project");
      } catch (err) {
        return errorResult(
          "secrets-scan-project",
          "SCAN_PROJECT_ERROR",
          `Error escaneando proyecto: ${err}`
        );
      }
    },
  };
}
