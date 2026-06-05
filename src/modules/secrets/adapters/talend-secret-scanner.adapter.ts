import { listFilesRecursive, readTextFile } from "../../../talend/files";
import type { IFileSystem, SecretPattern } from "../ports/file-system.port";
import { SECRET_PATTERNS } from "../ports/file-system.port";
import type { SecretFinding } from "../domain/secret-finding.types";

export class TalendSecretScannerAdapter implements IFileSystem {
  private patterns = SECRET_PATTERNS;

  async readFile(path: string): Promise<string> {
    return readTextFile(path);
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await readTextFile(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string, extensions: string[] = [".item", ".properties"]): Promise<string[]> {
    const allFiles = await listFilesRecursive(dir, (ruta) => {
      return extensions.some((ext) => ruta.endsWith(ext));
    });
    return allFiles;
  }

  async scanFileForSecrets(filePath: string): Promise<SecretFinding[]> {
    const findings: SecretFinding[] = [];

    try {
      const content = await this.readFile(filePath);
      const lines = content.split("\n");

      for (const pattern of this.patterns) {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum] ?? "";
          const match = regex.exec(line);

          if (match && match[0]) {
            const matchedValue = match[0];
            const maskedValue = this.maskValue(matchedValue);

            findings.push({
              file: filePath,
              component: this.extractComponentName(line, filePath),
              parameter: this.extractParameterName(line),
              maskedValue,
              valuePresent: true,
              risk: pattern.risk,
              suggestedFix: pattern.suggestedFix,
              line: lineNum + 1,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return findings;
  }

  private maskValue(value: string): string {
    if (!value || value.length <= 4) {
      return "••••••••";
    }
    const firstThree = value.substring(0, 3);
    return `${firstThree}••••••••`;
  }

  private extractComponentName(line: string, filePath: string): string {
    const componentMatch = line.match(/componentName="([^"]+)"/);
    if (componentMatch && componentMatch[1]) {
      return componentMatch[1];
    }
    const uniqueNameMatch = line.match(/uniqueName="([^"]+)"/);
    if (uniqueNameMatch && uniqueNameMatch[1]) {
      return uniqueNameMatch[1];
    }
    return filePath.split("/").pop() ?? "unknown";
  }

  private extractParameterName(line: string): string {
    const paramMatch = line.match(/(?:password|passwd|pwd|secret|key|token|credential|api[_-]?key)\s*=\s*["']?([^"'\s&;]+)/i);
    if (paramMatch && paramMatch[1]) {
      return paramMatch[1];
    }
    const nameMatch = line.match(/name="([^"]+)"/);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1];
    }
    return "unknown";
  }
}
