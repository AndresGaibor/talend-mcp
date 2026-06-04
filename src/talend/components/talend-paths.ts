import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectRuntimeOS } from "../../platform/runtime";
import { createPlatformContext } from "../../platform";
import { toMcpPath } from "../../platform/path-bridge";

export type TalendStudioCandidates = {
  pluginsDirCandidates: string[];
  studioHomeCandidates: string[];
};

function getPlatformCandidates(): TalendStudioCandidates {
  const os = detectRuntimeOS();

  if (os === "macos") {
    return {
      pluginsDirCandidates: [
        "/Applications/TalendStudio-8.0.1/studio/plugins",
        "/Applications/TalendStudio-7.3.1/studio/plugins",
      ],
      studioHomeCandidates: [
        "/Applications/TalendStudio-8.0.1/studio",
        "/Applications/TalendStudio-7.3.1/studio",
        "/Applications/Talicend Studio.app",
      ],
    };
  }

  if (os === "windows") {
    const pf = process.env["ProgramFiles"] ?? "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return {
      pluginsDirCandidates: [
        join(pf, "TalendStudio-8.0.1", "studio", "plugins"),
        join(pf86, "TalendStudio-8.0.1", "studio", "plugins"),
      ],
      studioHomeCandidates: [
        join(pf, "TalendStudio-8.0.1", "studio"),
        join(pf86, "TalendStudio-8.0.1", "studio"),
      ],
    };
  }

  if (os === "wsl") {
    return {
      pluginsDirCandidates: [
        "/mnt/c/Program Files/TalendStudio-8.0.1/studio/plugins",
      ],
      studioHomeCandidates: [
        "/mnt/c/Program Files/TalendStudio-8.0.1/studio",
      ],
    };
  }

  return {
    pluginsDirCandidates: [
      "/opt/talend/studio/plugins",
      "/usr/local/talend/studio/plugins",
    ],
    studioHomeCandidates: [
      "/opt/talend/studio",
      "/usr/local/talend/studio",
    ],
  };
}

export function resolveTalendPluginsDir(input?: {
  talendStudioHome?: string;
  pluginsDir?: string;
}): string | null {
  const ctx = createPlatformContext();

  if (input?.pluginsDir && existsSync(toMcpPath(input.pluginsDir, ctx))) {
    return toMcpPath(input.pluginsDir, ctx);
  }

  const envPluginsDir = process.env.TALEND_STUDIO_PLUGINS_DIR;
  if (envPluginsDir) {
    const mcpPath = toMcpPath(envPluginsDir, ctx);
    if (existsSync(mcpPath)) {
      return mcpPath;
    }
  }

  const home =
    input?.talendStudioHome ??
    process.env.TALEND_STUDIO_HOME ??
    process.env.TALEND_STUDIO_PATH;

  if (home) {
    const mcpHome = toMcpPath(home, ctx);
    const plugins = join(mcpHome, "plugins");
    if (existsSync(plugins)) {
      return plugins;
    }
  }

  const { pluginsDirCandidates } = getPlatformCandidates();
  for (const candidate of pluginsDirCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveTalendStudioHome(input?: {
  talendStudioHome?: string;
}): string | null {
  const ctx = createPlatformContext();

  const home =
    input?.talendStudioHome ??
    process.env.TALEND_STUDIO_HOME ??
    process.env.TALEND_STUDIO_PATH;

  if (home) {
    const mcpHome = toMcpPath(home, ctx);
    if (existsSync(mcpHome)) {
      return mcpHome;
    }
  }

  const { studioHomeCandidates } = getPlatformCandidates();
  for (const candidate of studioHomeCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}