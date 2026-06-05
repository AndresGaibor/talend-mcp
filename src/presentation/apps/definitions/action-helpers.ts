import type { PresentationAppAction } from "../app-types";

export function createTextAction(
  label: string,
  toolName: string,
  description: string,
  argumentName: string,
  options?: Omit<PresentationAppAction, "label" | "toolName" | "description" | "inputMode" | "argumentName">,
): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "text",
    argumentName,
    ...options,
  };
}

export function createJsonAction(
  label: string,
  toolName: string,
  description: string,
  defaultValue: Record<string, unknown>,
  options?: Omit<PresentationAppAction, "label" | "toolName" | "description" | "inputMode" | "defaultValue">,
): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "json",
    defaultValue: JSON.stringify(defaultValue),
    ...options,
  };
}

export function createNoInputAction(label: string, toolName: string, description: string): PresentationAppAction {
  return {
    label,
    toolName,
    description,
    inputMode: "none",
  };
}
