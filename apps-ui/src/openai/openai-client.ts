import type { OpenAiGlobals, ToolResult } from "./openai-types";

export function toolOutput(toolUseId: string, output: string): void {
  if (window.openai?.toolOutput) {
    window.openai.toolOutput(toolUseId, output);
  }
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (window.openai?.callTool) {
    return window.openai.callTool(toolName, args);
  }
  return { success: false, error: "ChatGPT API not available" };
}

export function setGlobals(globals: OpenAiGlobals): void {
  if (window.openai?.setGlobals) {
    window.openai.setGlobals(globals);
  }
}