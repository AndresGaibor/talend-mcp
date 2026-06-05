export type SecretRisk = "high" | "medium" | "low";

export interface SecretFinding {
  file: string;
  component: string;
  parameter: string;
  maskedValue: string;
  valuePresent: true;
  risk: SecretRisk;
  suggestedFix: string;
  line?: number;
}

export interface SecretScanSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface SecretScanResult {
  secretsFound: number;
  filesScanned: number;
  summary: SecretScanSummary;
  findings: SecretFinding[];
  jobName?: string;
  scanType: "project" | "job";
}

export interface ContextMigrationSuggestion {
  jobName: string;
  parameterName: string;
  currentValue: string;
  maskedValue: string;
  valuePresent: true;
  contextName: string;
  contextType: string;
  migrationSteps: string[];
  priority: SecretRisk;
}

export interface SuggestContextMigrationResult {
  jobName: string;
  suggestions: ContextMigrationSuggestion[];
  count: number;
}
