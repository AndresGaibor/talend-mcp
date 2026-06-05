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
  toolOutput: (toolUseId: string, output: string) => void;
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<ToolResult>;
  setGlobals: (globals: OpenAiGlobals) => void;
}

export interface Window {
  openai?: OpenAiBridge;
}

declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}