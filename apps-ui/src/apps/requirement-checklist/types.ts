export interface RequirementItem {
  id: string;
  description: string;
  responsibility: "talend" | "sql" | "external" | "report";
  status: "pending" | "in_progress" | "completed" | "not_applicable";
  suggestedTool?: string;
  evidence?: string;
  priority: "high" | "medium" | "low";
}

export interface RequirementAnalysisResult {
  requirements: RequirementItem[];
  summary: {
    total: number;
    talend: number;
    sql: number;
    external: number;
    report: number;
  };
}

export interface TalendResponsibility {
  task: string;
  tool: string;
  reason: string;
}

export interface ChecklistBuildResult {
  checklist: RequirementItem[];
  totalItems: number;
  byResponsibility: Record<string, number>;
}