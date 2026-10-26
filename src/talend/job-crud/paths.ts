import { join } from "node:path";

export function normalizeFolderPath(folderPath?: string): string | undefined {
  const normalized = folderPath?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return undefined;

  const parts = normalized.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Ruta de carpeta inválida: ${folderPath}`);
  }

  return normalized;
}

export function processDir(projectPath: string): string {
  return join(projectPath, "process");
}

export function resolveFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(processDir(projectPath), ...normalized.split("/")) : processDir(projectPath);
}

export function resolveFolderState(folderPath?: string): string {
  return normalizeFolderPath(folderPath) ?? "";
}

export function xmlAttribute(value: string): string {
  return value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char]!);
}

export function jobletsDir(projectPath: string): string {
  return join(projectPath, "joblets");
}

export function resolveJobletFolderDir(projectPath: string, folderPath?: string): string {
  const normalized = normalizeFolderPath(folderPath);
  return normalized ? join(jobletsDir(projectPath), ...normalized.split("/")) : jobletsDir(projectPath);
}
