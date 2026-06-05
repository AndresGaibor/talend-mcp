import type { TalendJobResource } from "../../../talend/types";
import type { SecretScanResult } from "../domain/secret-finding.types";
import type { IJobRepository } from "../ports/job-repository.port";
import type { IFileSystem } from "../ports/file-system.port";
import { TalendSecretScannerAdapter } from "../adapters/talend-secret-scanner.adapter";

export class ScanJobSecretsUseCase {
  private scanner: IFileSystem;

  constructor(
    private jobRepo: IJobRepository,
    scanner?: IFileSystem
  ) {
    this.scanner = scanner || new TalendSecretScannerAdapter();
  }

  async execute(projectPath: string, jobName: string): Promise<SecretScanResult> {
    if (!projectPath) {
      throw new Error("Ruta de proyecto es requerida");
    }
    if (!jobName) {
      throw new Error("Nombre de job es requerido");
    }

    const job = await this.jobRepo.findJobByName(projectPath, jobName);
    if (!job) {
      return {
        secretsFound: 0,
        filesScanned: 0,
        summary: { high: 0, medium: 0, low: 0, total: 0 },
        findings: [],
        jobName,
        scanType: "job",
      };
    }

    const findings = await this.scanJobFiles(job);

    return {
      secretsFound: findings.length,
      filesScanned: 2,
      summary: this.calculateSummary(findings),
      findings,
      jobName,
      scanType: "job",
    };
  }

  private async scanJobFiles(job: TalendJobResource): Promise<SecretScanResult["findings"]> {
    const allFindings: SecretScanResult["findings"] = [];

    const itemFindings = await this.scanner.scanFileForSecrets(job.itemPath);
    allFindings.push(...itemFindings);

    const propsFindings = await this.scanner.scanFileForSecrets(job.propertiesPath);
    allFindings.push(...propsFindings);

    return allFindings;
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
