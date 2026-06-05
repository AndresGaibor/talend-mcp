import type { SecretFinding } from "../domain/secret-finding.types";

export interface IFileSystem {
  readFile(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  listFiles(dir: string, extensions?: string[]): Promise<string[]>;
  scanFileForSecrets(filePath: string): Promise<SecretFinding[]>;
}

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  risk: "high" | "medium" | "low";
  suggestedFix: string;
  isLikelySecret: (value: string) => boolean;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    pattern: /AKIA[0-9A-Z]{16}/,
    risk: "high",
    suggestedFix: "Usar contexto con variable AWS_ACCESS_KEY_ID",
    isLikelySecret: (v) => v.startsWith("AKIA"),
  },
  {
    name: "AWS Secret Key",
    pattern: /[A-Za-z0-9/+=]{40}/,
    risk: "high",
    suggestedFix: "Usar contexto con variable AWS_SECRET_ACCESS_KEY",
    isLikelySecret: (v) => /^[A-Za-z0-9/+=]{40}$/.test(v) && !v.includes(" "),
  },
  {
    name: "Generic API Key",
    pattern: /[a-zA-Z0-9]{32,64}/,
    risk: "medium",
    suggestedFix: "Usar contexto con variable API_KEY",
    isLikelySecret: (v) => /^[a-zA-Z0-9]{32,64}$/.test(v),
  },
  {
    name: "Password in URL",
    pattern: /:[^:@]+@[a-zA-Z0-9.-]+/,
    risk: "high",
    suggestedFix: "Usar contexto con variable de contraseña",
    isLikelySecret: (v) => /:[^:@]+@/.test(v),
  },
  {
    name: "Connection String",
    pattern: /(mongodb|postgres|mysql|redis|sqlserver):\/\/[^@]+@/,
    risk: "high",
    suggestedFix: "Usar contexto con variable de conexión",
    isLikelySecret: (v) => /(mongodb|postgres|mysql|redis|sqlserver):\/\/[^@]+@/.test(v),
  },
  {
    name: "Bearer Token",
    pattern: /Bearer\s+[a-zA-Z0-9_-]+/,
    risk: "high",
    suggestedFix: "Usar contexto con variable TOKEN",
    isLikelySecret: (v) => /^Bearer\s+[a-zA-Z0-9_-]+$/.test(v),
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    risk: "high",
    suggestedFix: "Usar contexto con variable PRIVATE_KEY_PATH",
    isLikelySecret: (v) => v.includes("PRIVATE KEY"),
  },
  {
    name: "Database Password",
    pattern: /(password|pwd|pass)=([^;&]+)/i,
    risk: "high",
    suggestedFix: "Usar contexto con variable DB_PASSWORD",
    isLikelySecret: (v) => /(password|pwd|pass)=([^;&]+)/i.test(v),
  },
];
