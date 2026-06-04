export interface ToolContext {
  projectPath: string;
  requestId?: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}