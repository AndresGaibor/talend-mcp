import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { readTextFile, listFilesRecursive } from "../files";
import { getConfiguredProjectPath } from "../workspace";

interface SecretFinding {
  file: string;
  component?: string;
  parameter: string;
  value: string;
  risk: "high" | "medium" | "low";
  description: string;
  suggestedFix: string;
}

interface SecretScanResult {
  projectPath: string;
  filesScanned: number;
  secretsFound: number;
  findings: SecretFinding[];
  summary: {
    high: number;
    medium: number;
    low: number;
  };
}

const SECRET_PATTERNS = [
  { pattern: /password\s*=\s*["'][^"']{1,50}["']/gi, risk: "high" as const, description: "Password en texto plano", suggestion: "Usar contexto con variable de entorno o credential store" },
  { pattern: /passwd\s*=\s*["'][^"']{1,50}["']/gi, risk: "high" as const, description: "Passwd en texto plano", suggestion: "Usar contexto con переменная de entorno o credential store" },
  { pattern: /db_password\s*=\s*["'][^"']{1,50}["']/gi, risk: "high" as const, description: "Database password en texto plano", suggestion: "Migrar a context profile con secret storage" },
  { pattern: /secret\s*=\s*["'][^"']{1,50}["']/gi, risk: "high" as const, description: "Secret en texto plano", suggestion: "Usar credential store o vault" },
  { pattern: /api[_-]?key\s*=\s*["'][^"']{1,50}["']/gi, risk: "high" as const, description: "API key en texto plano", suggestion: "Usar переменная de entorno o secret management" },
  { pattern: /token\s*=\s*["'][^"']{1,50}["']/gi, risk: "medium" as const, description: "Token en texto plano", suggestion: "Verificar si es un token temporal o persistente" },
  { pattern: /connection\s*=\s*["'][^"']{5,}["']/gi, risk: "medium" as const, description: "Connection string con credenciales", suggestion: "Usar context profile para la conexión" },
  { pattern: /private[_-]?key\s*=\s*["'][^"']{1,200}["']/gi, risk: "high" as const, description: "Private key expuesta", suggestion: "Almacenar en location segura, nunca en repo" },
];

async function scanFileForSecrets(filePath: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];

  try {
    const content = await readTextFile(filePath);

    for (const { pattern, risk, description, suggestion } of SECRET_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const fullMatch = match[0];
        const paramMatch = fullMatch.match(/(\w+)\s*=/);
        const param = paramMatch?.[1] ?? "UNKNOWN";
        const value = match[1] ?? match[0];

        if (value.length > 3 && !value.includes("${") && !value.includes("context.")) {
          findings.push({
            file: filePath,
            parameter: param,
            value: value.substring(0, 20) + "***",
            risk,
            description,
            suggestedFix: suggestion,
          });
        }
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return findings;
}

async function scanJobForSecrets(jobPath: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];
  const files = await listFilesRecursive(jobPath, (ruta) => ruta.endsWith(".item") || ruta.endsWith(".properties"));

  for (const file of files) {
    const fileFindings = await scanFileForSecrets(file);
    findings.push(...fileFindings);
  }

  return findings;
}

export const secretTools = [
  {
    name: "talend_secret_scan_project",
    description: "Escanea todo el proyecto Talend en busca de secretos expuestos (passwords, tokens, API keys).",
    inputSchema: z.object({}),
    handler: async (): Promise<ReturnType<typeof bridgeOk>> => {
      const projectPath = getConfiguredProjectPath();

      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-project",
          error: { code: "NO_PROJECT_PATH", message: "No se encontró la ruta del proyecto Talend" },
        });
      }

      try {
        const allFindings: SecretFinding[] = [];
        const itemFiles = await listFilesRecursive(projectPath, (ruta) => ruta.endsWith(".item"));

        for (const file of itemFiles) {
          const findings = await scanFileForSecrets(file);
          allFindings.push(...findings);
        }

        const result: SecretScanResult = {
          projectPath,
          filesScanned: itemFiles.length,
          secretsFound: allFindings.length,
          findings: allFindings,
          summary: {
            high: allFindings.filter((f) => f.risk === "high").length,
            medium: allFindings.filter((f) => f.risk === "medium").length,
            low: allFindings.filter((f) => f.risk === "low").length,
          },
        };

        return bridgeOk({
          ok: true,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-project",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-project",
          error: { code: "SCAN_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_secret_scan_job",
    description: "Escanea un job específico en busca de secretos expuestos.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job a escanear"),
      folderPath: z.string().optional().describe("Carpeta del job (opcional)"),
    }),
    handler: async ({ jobName, folderPath }: { jobName: string; folderPath?: string }): Promise<ReturnType<typeof bridgeOk>> => {
      const projectPath = getConfiguredProjectPath();

      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-job",
          error: { code: "NO_PROJECT_PATH", message: "No se encontró la ruta del proyecto Talend" },
        });
      }

      try {
        const searchPath = folderPath
          ? `${projectPath}/process/${folderPath}/${jobName}`
          : `${projectPath}/process/${jobName}`;

        const findings = await scanJobForSecrets(searchPath);

        const result = {
          jobName,
          folderPath: folderPath ?? "process",
          filesScanned: 0,
          secretsFound: findings.length,
          findings,
          summary: {
            high: findings.filter((f) => f.risk === "high").length,
            medium: findings.filter((f) => f.risk === "medium").length,
            low: findings.filter((f) => f.risk === "low").length,
          },
        };

        return bridgeOk({
          ok: true,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-job",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/scan-job",
          error: { code: "SCAN_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_secret_suggest_context_migration",
    description: "Sugiere cómo migrar secretos expuestos a context profiles.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job con secretos"),
    }),
    handler: async ({ jobName }: { jobName: string }): Promise<ReturnType<typeof bridgeOk>> => {
      const projectPath = getConfiguredProjectPath();

      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/suggest-context",
          error: { code: "NO_PROJECT_PATH", message: "No se encontró la ruta del proyecto Talend" },
        });
      }

      try {
        const jobPath = `${projectPath}/process/${jobName}`;
        const findings = await scanJobForSecrets(jobPath);

        const secrets = findings.filter((f) => f.risk === "high" || f.risk === "medium");

        const suggestions = secrets.map((secret) => ({
          parameter: secret.parameter,
          currentValue: secret.value,
          suggestedContextVar: secret.parameter.replace(/(password|passwd|secret|key|token)/i, "MY_${1}".toUpperCase()),
          contextProfile: "SecureCredentials",
          migrationSteps: [
            `1. Crear context profile "${secret.parameter}_PROD" con valor real`,
            `2. Reemplazar "${secret.parameter}=XXX" por "${secret.parameter}=context.${secret.parameter}"`,
            `3. Agregar el parámetro al context del job`,
            `4. Validar que el job funciona con el nuevo context`,
          ],
        }));

        const result = {
          jobName,
          secretsFound: secrets.length,
          suggestions,
          estimatedEffort: secrets.length * 15,
          warning: secrets.length > 0
            ? `Encontrados ${secrets.length} secretos que deben migrarse antes de pasar a producción`
            : "No se encontraron secretos de alto riesgo",
        };

        return bridgeOk({
          ok: true,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/suggest-context",
          data: result,
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "secret-scanner",
          confidence: "high",
          endpoint: "/secret/suggest-context",
          error: { code: "SCAN_FAILED", message: String(err) },
        });
      }
    },
  },
];
