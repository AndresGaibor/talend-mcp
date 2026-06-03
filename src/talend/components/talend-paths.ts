import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolveTalendPluginsDir(input?: {
  talendStudioHome?: string;
  pluginsDir?: string;
}): string | null {
  if (input?.pluginsDir && existsSync(input.pluginsDir)) {
    return input.pluginsDir;
  }

  const envPluginsDir = process.env.TALEND_STUDIO_PLUGINS_DIR;
  if (envPluginsDir && existsSync(envPluginsDir)) {
    return envPluginsDir;
  }

  const home =
    input?.talendStudioHome ??
    process.env.TALEND_STUDIO_HOME ??
    process.env.TALEND_STUDIO_PATH;

  if (home) {
    const plugins = join(home, "plugins");
    if (existsSync(plugins)) {
      return plugins;
    }
  }

  const macDefault = "/Applications/TalendStudio-8.0.1/studio/plugins";
  if (existsSync(macDefault)) {
    return macDefault;
  }

  return null;
}

export function resolveTalendStudioHome(input?: {
  talendStudioHome?: string;
}): string | null {
  const home =
    input?.talendStudioHome ??
    process.env.TALEND_STUDIO_HOME ??
    process.env.TALEND_STUDIO_PATH;

  if (home && existsSync(home)) {
    return home;
  }

  const macDefault = "/Applications/TalendStudio-8.0.1/studio";
  if (existsSync(macDefault)) {
    return macDefault;
  }

  return null;
}