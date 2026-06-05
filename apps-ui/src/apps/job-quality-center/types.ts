export type SeverityLevel = "critical" | "high" | "medium" | "low";

export interface QualityIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  fixSolution?: string;
  componentName?: string;
  lineNumber?: number;
}

export interface QualityReport {
  jobId: string;
  score: number;
  issues: QualityIssue[];
  lastUpdated: string;
}
