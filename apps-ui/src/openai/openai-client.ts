import type { OpenAiBridge } from "./openai-types";

// Extender Window globalmente para TypeScript
declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}

/**
 * Obtiene la salida inicial de la herramienta (toolOutput) desde la bridge de OpenAI.
 */
export function getInitialToolOutput<T>(): T | null {
  if (typeof window !== "undefined" && window.openai?.toolOutput) {
    return window.openai.toolOutput as T;
  }
  return null;
}

/**
 * Obtiene la entrada de la herramienta (toolInput) desde la bridge de OpenAI.
 */
export function getToolInput<T>(): T | null {
  if (typeof window !== "undefined" && window.openai?.toolInput) {
    return window.openai.toolInput as T;
  }
  return null;
}

/**
 * Llama a una herramienta de MCP a través de la bridge de OpenAI.
 */
export async function callTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  if (typeof window !== "undefined" && window.openai?.callTool) {
    return await window.openai.callTool(toolName, input);
  }
  console.warn("window.openai.callTool no disponible");
  return { success: false, error: "No conectado a ChatGPT" };
}

/**
 * Obtiene el estado actual del widget desde la bridge de OpenAI.
 */
export function getWidgetState<T>(): T | null {
  if (typeof window !== "undefined" && window.openai?.widgetState) {
    return window.openai.widgetState as T;
  }
  return null;
}

/**
 * Actualiza el estado del widget a través de la bridge de OpenAI.
 */
export function setWidgetState<T>(state: T): void {
  if (typeof window !== "undefined" && window.openai?.setWidgetState) {
    window.openai.setWidgetState(state);
  }
}
