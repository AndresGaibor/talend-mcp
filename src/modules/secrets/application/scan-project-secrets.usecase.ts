import type { SecretScanResult } from "../domain/secret-finding.types";
import type { IFileSystem } from "../ports/file-system.port";
import { TalendSecretScannerAdapter } from "../adapters/talend-secret-scanner.adapter";

export class ScanProjectSecretsUseCase {
  private scanner: IFileSystem;

  constructor(scanner?: IFileSystem) {
    this.scanner = scanner || new TalendSecretScannerAdapter();
  }

  async execute(projectPath: string): Promise<SecretScanResult> {
    if (!projectPath) {
      throw new Error("Ruta de proyecto es requerida");
    }

    const processPath = `${projectPath}/process`;
    const files = await this.scanner.listFiles(processPath, [".item", ".properties"]);

    const allFindings = [];
    for (const file of files) {
      const findings = await this.scanner.scanFileForSecrets(file);
      allFindings.push(...findings);
    }

    const summary = this.calculateSummary(allFindings);

    return {
      secretsFound: allFindings.length,
      filesScanned: files.length,
      summary,
      findings: allFindings,
      scanType: "project",
    };
  }

  private calculateSummary(findings: { risk: string }[]) {
    const high = findings.filter((f) => f.risk === "high").length;
    const medium = findings.filter((f) => f.risk === "medium").length;
    const low = findings.filter((f) => f.risk === "low").length;

    return {
      high,
      medium,
      low,
      total: high + medium + low,
    };
  }
}
