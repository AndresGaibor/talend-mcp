export type TalendResult<T> = {
  ok: boolean;
  source: string;
  confidence: "high" | "medium" | "low" | "none";
  data?: T;
  warnings?: string[];
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  nextActions?: Array<{
    label: string;
    toolName: string;
    input?: Record<string, unknown>;
  }>;
};
