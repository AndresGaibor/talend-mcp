export interface OpenAiGlobals {
  document: string;
  cursor: string;
  selection: string;
  clipboard: string;
}

export interface OpenAiBridge {
  toolOutput?: unknown;
  toolInput?: unknown;
  widgetState?: unknown;
  callTool?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  setWidgetState?: (state: unknown) => void;
  requestModal?: (options: { content: string; title?: string; mimeType?: string }) => void;
  requestDisplayMode?: (mode: "inline" | "fullscreen" | "modal") => void;
  sendFollowUpMessage?: (message: string) => void;
  notifyIntrinsicHeight?: (height: number) => void;
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

export interface Window {
  openai?: OpenAiBridge;
}

declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}
