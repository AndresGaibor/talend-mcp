import { basename, dirname, join, normalize, sep } from "node:path";
import { spawnSync } from "node:child_process";
import type { PlatformContext } from "./runtime";

function tryWslpathToWindows(posixPath: string): string | undefined {
  try {
    const result = spawnSync("wslpath", ["-w", posixPath], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  } catch {}
  return undefined;
}

function tryWslpathToPosix(windowsPath: string): string | undefined {
  try {
    const result = spawnSync("wslpath", ["-u", windowsPath], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  } catch {}
  return undefined;
}

function wslToWindowsManual(posixPath: string): string {
  const match = posixPath.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (match) {
    const drive = match[1]!.toUpperCase();
    const rest = match[2]!.replace(/\//g, "\\");
    return `${drive}:\\${rest}`;
  }
  return posixPath.replace(/\//g, "\\");
}

function windowsToWslManual(windowsPath: string): string {
  const cleaned = windowsPath.replace(/\\/g, "/");
  const match = cleaned.match(/^([a-zA-Z]):\/(.*)$/);
  if (match) {
    const drive = match[1]!.toLowerCase();
    const rest = match[2]!;
    return `/mnt/${drive}/${rest}`;
  }
  return cleaned;
}

export function toMcpPath(talendHostPath: string, ctx: PlatformContext): string {
  if (ctx.pathMode !== "wsl-windows") return talendHostPath;

  if (talendHostPath.includes(":\\") || talendHostPath.startsWith("\\\\")) {
    const wslResult = tryWslpathToPosix(talendHostPath);
    if (wslResult) return wslResult;
    return windowsToWslManual(talendHostPath);
  }

  return talendHostPath;
}

export function toTalendHostPath(mcpPath: string, ctx: PlatformContext): string {
  if (ctx.pathMode !== "wsl-windows") return mcpPath;

  if (mcpPath.startsWith("/mnt/")) {
    const wslResult = tryWslpathToWindows(mcpPath);
    if (wslResult) return wslResult;
    return wslToWindowsManual(mcpPath);
  }

  return mcpPath;
}

export function normalizeLogicalTalendFolderPath(folderPath: string): string {
  const normalized = folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return "";
  const parts = normalized.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Ruta de carpeta inválida: ${folderPath}`);
  }
  return normalized;
}

export function getBaseNamePortable(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? "";
}

export function getDirNamePortable(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) return ".";
  return normalized.slice(0, idx) || "/";
}

export function splitPortable(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}
