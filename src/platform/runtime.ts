import { readFileSync } from "node:fs";

export type RuntimeOS = "macos" | "windows" | "linux" | "wsl";

export type TalendHostOS = "macos" | "windows" | "linux";

export type PathMode = "native" | "wsl-windows";

export type PlatformContext = {
  runtimeOs: RuntimeOS;
  talendHostOs: TalendHostOS;
  pathMode: PathMode;
};

export function isWsl(): boolean {
  try {
    const version = readFileSync("/proc/version", "utf8").toLowerCase();
    if (version.includes("microsoft") || version.includes("wsl")) return true;
  } catch {}
  try {
    if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  } catch {}
  return false;
}

export function detectRuntimeOS(overrides?: {
  platform?: string;
  isWslOverride?: boolean;
}): RuntimeOS {
  if (overrides?.platform) {
    if (overrides.platform === "darwin") return "macos";
    if (overrides.platform === "win32") return "windows";
    if (overrides.platform === "linux" && (overrides.isWslOverride ?? isWsl())) return "wsl";
    return "linux";
  }
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux" && isWsl()) return "wsl";
  return "linux";
}

export function detectTalendHostOS(talendHostOsEnv?: string): TalendHostOS {
  if (talendHostOsEnv === "macos") return "macos";
  if (talendHostOsEnv === "windows") return "windows";
  if (talendHostOsEnv === "linux") return "linux";

  const runtime = detectRuntimeOS();
  if (runtime === "wsl") return "windows";
  if (runtime === "macos") return "macos";
  if (runtime === "windows") return "windows";
  return "linux";
}

export function detectPathMode(
  talendPathModeEnv?: string,
  runtimeOs?: RuntimeOS,
  talendHostOs?: TalendHostOS,
): PathMode {
  if (talendPathModeEnv === "wsl-windows") return "wsl-windows";
  if (talendPathModeEnv === "native") return "native";

  const rt = runtimeOs ?? detectRuntimeOS();
  const th = talendHostOs ?? detectTalendHostOS();
  if (rt === "wsl" && th === "windows") return "wsl-windows";
  return "native";
}

export function createPlatformContext(overrides?: {
  talendHostOs?: string;
  pathMode?: string;
  runtimeOs?: RuntimeOS;
  platformOverrides?: { platform?: string; isWslOverride?: boolean };
}): PlatformContext {
  const runtimeOs = overrides?.runtimeOs ?? detectRuntimeOS(overrides?.platformOverrides);
  const talendHostOs = detectTalendHostOS(overrides?.talendHostOs ?? process.env.TALEND_HOST_OS);
  const pathMode = detectPathMode(
    overrides?.pathMode ?? process.env.TALEND_PATH_MODE,
    runtimeOs,
    talendHostOs,
  );
  return { runtimeOs, talendHostOs, pathMode };
}