import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { detectRuntimeOS } from "../../platform/runtime";
import { createPlatformContext } from "../../platform";
import { toMcpPath } from "../../platform/path-bridge";

export type TalendStudioCandidates = {
  pluginsDirCandidates: string[];
  studioHomeCandidates: string[];
};

function getStudioVersion(): string {
  return process.env.TALEND_STUDIO_VERSION ?? "8.0.1";
}

function getTalendBaseDir(): string {
  return process.env.TALEND_BASE_DIR ?? (detectRuntimeOS() === "windows" ? "C:\\Program Files" : "/opt/talend");
}

function getPlatformCandidates(): TalendStudioCandidates {
  const os = detectRuntimeOS();
  const version = getStudioVersion();

  if (os === "macos") {
    return {
      pluginsDirCandidates: [
        `${getTalendBaseDir()}/TalendStudio-${version}/studio/plugins`,
        `${getTalendBaseDir()}/TalendStudio-7.3.1/studio/plugins`,
        ...scanVersionedStudio("/Applications"),
        ...scanVersionedStudio("/opt"),
      ],
      studioHomeCandidates: [
        `${getTalendBaseDir()}/TalendStudio-${version}/studio`,
        `${getTalendBaseDir()}/TalendStudio-7.3.1/studio`,
        "/Applications/Talend Studio.app",
      ],
    };
  }

  if (os === "windows") {
    const base = getTalendBaseDir();
    const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return {
      pluginsDirCandidates: [
        join(base, `TalendStudio-${version}`, "studio", "plugins"),
        join(pf86, `TalendStudio-${version}`, "studio", "plugins"),
        // Instalaciones tipo C:\Talend\<version>\studio\plugins
        ...scanVersionedStudio("C:\\Talend"),
        ...scanVersionedStudio("D:\\Talend"),
        ...scanVersionedStudio(localAppData),
        ...scanVersionedStudio(process.env.PROGRAMFILES ?? "C:\\Program Files"),
        ...scanVersionedStudio(pf86),
      ],
      studioHomeCandidates: [
        join(base, `TalendStudio-${version}`, "studio"),
        join(pf86, `TalendStudio-${version}`, "studio"),
      ],
    };
  }

  if (os === "wsl") {
    return {
      pluginsDirCandidates: [
        `/mnt/c/Program Files/TalendStudio-${version}/studio/plugins`,
        ...scanVersionedStudio("/mnt/c/Talend"),
        ...scanVersionedStudio("/mnt/c/Program Files"),
      ],
      studioHomeCandidates: [
        `/mnt/c/Program Files/TalendStudio-${version}/studio`,
      ],
    };
  }

  return {
    pluginsDirCandidates: [
      "/opt/talend/studio/plugins",
      "/usr/local/talend/studio/plugins",
      ...scanVersionedStudio("/opt"),
    ],
    studioHomeCandidates: [
      "/opt/talend/studio",
      "/usr/local/talend/studio",
    ],
  };
}

/**
 * Busca instalaciones con el layout `<raiz>/<version>/studio`.
 *
 * Es el layout que usa el instalador del plugin (`scripts/install-bridge.ts`):
 * Windows `C:\Talend\8.0.1\studio`, macOS `/Applications/Talend Studio 8.0.1/studio`.
 */
function scanVersionedStudio(root: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return found;
  }

  for (const entry of entries) {
    const studio = join(root, entry, "studio");
    if (existsSync(studio)) {
      found.push(join(studio, "plugins"));
    }
  }

  return found;
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