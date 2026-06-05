export interface OpenAiGlobals {
  document: string;
  cursor: string;
  selection: string;
  clipboard: string;
}

export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface OpenAiToolOutput {
  toolUseId: string;
  output: string;
}

export interface OpenAiBridge {
  toolOutput?: unknown;
  toolInput?: unknown;
  widgetState?: unknown;
  callTool?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  setWidgetState?: (state: unknown) => void;
}

export interface Window {
  openai?: OpenAiBridge;
}

declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}