export interface MasteryStatus {
  totalComponents: number;
  masteredCount: number;
  inProgressCount: number;
  failedCount: number;
  lastUpdated: string;
}

export interface MasteryComponentDetails {
  name: string;
  status: "mastered" | "in_progress" | "failed" | "not_started";
  masteryLevel: number;
  lastAttempt?: string;
  errorMessage?: string;
}