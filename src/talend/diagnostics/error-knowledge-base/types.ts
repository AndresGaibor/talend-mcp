/** Tipos de la base de conocimiento de errores de Talend Studio. */

export type KnownError = {
  id: string;
  patterns: string[];
  category: string;
  component?: string;
  cause: string;
  suggestedFix: string;
  canAutoFix: boolean;
  confidence: "high" | "medium" | "low";
  occurrences: number;
  lastSeen: number;
};

export type ErrorKnowledgeBase = {
  version: number;
  generatedAt: number;
  errors: KnownError[];
};
