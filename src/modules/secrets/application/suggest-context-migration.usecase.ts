import type { TalendJobResource } from "../../../talend/types";
import type {
  ContextMigrationSuggestion,
  SuggestContextMigrationResult,
} from "../domain/secret-finding.types";
import type { IJobRepository } from "../ports/job-repository.port";

export class SuggestContextMigrationUseCase {
  constructor(private jobRepo: IJobRepository) {}

  async execute(projectPath: string, jobName: string): Promise<SuggestContextMigrationResult> {
    if (!projectPath) {
      throw new Error("Ruta de proyecto es requerida");
    }
    if (!jobName) {
      throw new Error("Nombre de job es requerido");
    }

    const job = await this.jobRepo.findJobByName(projectPath, jobName);
    if (!job) {
      return {
        jobName,
        suggestions: [],
        count: 0,
      };
    }

    const suggestions = await this.generateSuggestions(job);

    return {
      jobName,
      suggestions,
      count: suggestions.length,
    };
  }

  private async generateSuggestions(job: TalendJobResource): Promise<ContextMigrationSuggestion[]> {
    const suggestions: ContextMigrationSuggestion[] = [];
    const scannedFiles = [job.itemPath, job.propertiesPath];

    for (const filePath of scannedFiles) {
      const fileSuggestions = await this.analyzeFileForMigration(filePath);
      suggestions.push(...fileSuggestions);
    }

    return suggestions;
  }

  private async analyzeFileForMigration(filePath: string): Promise<ContextMigrationSuggestion[]> {
    const suggestions: ContextMigrationSuggestion[] = [];

    try {
      const { readTextFile } = await import("../../../talend/files");
      const content = await readTextFile(filePath);

      const secretPatterns = [
        { regex: /password\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "PASSWORD" },
        { regex: /pwd\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "PASSWORD" },
        { regex: /secret\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "SECRET" },
        { regex: /api[_-]?key\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "API_KEY" },
        { regex: /token\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "TOKEN" },
        { regex: /credential\s*=\s*["']?([^"'\s&;]+)/gi, paramName: "CREDENTIAL" },
      ];

      for (const pattern of secretPatterns) {
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

        while ((match = regex.exec(content)) !== null) {
          const rawValue = match[1] ?? "";
          const maskedValue = this.maskValue(rawValue);

          suggestions.push({
            jobName: filePath.split("/").pop()?.replace(".item", "").replace(".properties", "") || "",
            parameterName: pattern.paramName,
            currentValue: maskedValue,
            maskedValue,
            valuePresent: true,
            contextName: "Default",
            contextType: "Context",
            migrationSteps: [
              `1. Crear contexto "${pattern.paramName}_CTX" en el job`,
              `2. Agregar parámetro "${pattern.paramName}" al contexto`,
              `3. Migrar valor hardcoded a variable de contexto`,
              `4. Actualizar componente para usar context.${pattern.paramName}`,
            ],
            priority: this.determinePriority(pattern.paramName),
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return suggestions;
  }

  private maskValue(value: string): string {
    if (!value || value.length <= 4) {
      return "••••••••";
    }
    const firstThree = value.substring(0, 3);
    return `${firstThree}••••••••`;
  }

  private determinePriority(paramName: string): "high" | "medium" | "low" {
    const highPriority = ["PASSWORD", "SECRET", "CREDENTIAL", "TOKEN"];
    const mediumPriority = ["API_KEY"];

    if (highPriority.includes(paramName)) {
      return "high";
    }
    if (mediumPriority.includes(paramName)) {
      return "medium";
    }
    return "low";
  }
}
