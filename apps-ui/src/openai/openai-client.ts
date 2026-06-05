import type { OpenAiGlobals, ToolResult } from "./openai-types";

export function getInitialToolOutput<T>(): T | null {
  if (typeof window !== "undefined" && (window as any).openai?.toolOutput) {
    return (window as any).openai.toolOutput as T;
  }
  return null;
}

export async function callTool(
  toolName: string,
  input: unknown
): Promise<ToolResult> {
  if (typeof window !== "undefined" && (window as any).openai?.callTool) {
    return await (window as any).openai.callTool(toolName, input);
  }
  console.warn("window.openai.callTool not available, using mock");
  return { success: false, error: "Not connected to ChatGPT" };
}

export function getWidgetState<T>(): T | null {
  if (typeof window !== "undefined" && (window as any).openai?.widgetState) {
    return (window as any).openai.widgetState as T;
  }
  return null;
}

export function setWidgetState<T>(state: T): void {
  if (typeof window !== "undefined" && (window as any).openai?.setWidgetState) {
    (window as any).openai.setWidgetState(state);
  }
}

export function toolOutput(toolUseId: string, output: string): void {
  if (window.openai?.toolOutput) {
    window.openai.toolOutput(toolUseId, output);
  }
}

export function setGlobals(globals: OpenAiGlobals): void {
  if (window.openai?.setGlobals) {
    window.openai.setGlobals(globals);
  }
}