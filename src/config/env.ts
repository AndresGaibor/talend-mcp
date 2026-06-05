import { z } from "zod/v4";
import { createPlatformContext } from "../platform/platform-context";
import type { PlatformContext } from "../platform/platform-context";

export { createPlatformContext };

export const TalendMcpEnvSchema = z.object({
  TALEND_PROJECT: z.string().optional(),
  TALEND_WORKSPACE: z.string().optional(),
  TALEND_STUDIO_HOME: z.string().optional(),
  TALEND_STUDIO_PLUGINS_DIR: z.string().optional(),

  TALEND_HOST_OS: z.enum(["auto", "macos", "windows", "linux"]).default("auto"),
  TALEND_PATH_MODE: z.enum(["auto", "native", "wsl-windows"]).default("auto"),

  TALEND_BRIDGE_HOST: z.string().default("127.0.0.1"),
  TALEND_BRIDGE_PORT: z.coerce.number().default(3930),
  TALEND_BRIDGE_CONFIG: z.string().optional(),
  TALEND_BRIDGE_TOKEN: z.string().optional(),

  TALEND_BUILDS_DIR: z.string().optional(),
  TALEND_DISABLE_AUTODETECT: z.coerce.boolean().optional(),
});

export type TalendMcpEnv = z.infer<typeof TalendMcpEnvSchema>;

let parsedEnv: TalendMcpEnv | undefined;

export function getTalendMcpEnv(): TalendMcpEnv {
  return TalendMcpEnvSchema.parse(process.env);
}

export function getTalendMcpEnvCached(): TalendMcpEnv {
  if (parsedEnv) return parsedEnv;
  parsedEnv = TalendMcpEnvSchema.parse(process.env);
  return parsedEnv;
}

export function resetEnvCache(): void {
  parsedEnv = undefined;
}

function windowsToWslPath(windowsPath: string): string {
  const match = windowsPath.match(/^([A-Za-z]):[/\\](.*)$/);
  if (!match) return windowsPath;
  const [, drive, rest] = match;
  if (!drive || !rest) return windowsPath;
  return `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}`;
}

export function getTalendProjectPathForMcp(
  projectPath?: string,
  platformContext?: PlatformContext,
): string {
  const env = getTalendMcpEnvCached();
  const path = projectPath ?? env.TALEND_PROJECT ?? "";
  if (!path) return path;

  const ctx = platformContext ?? createPlatformContext();
  if (ctx.pathMode === "wsl-windows" && ctx.talendHostOs === "windows") {
    return windowsToWslPath(path);
  }
  return path;
}

export function getTalendWorkspacePathForMcp(
  workspacePath?: string,
  platformContext?: PlatformContext,
): string {
  const env = getTalendMcpEnvCached();
  const path = workspacePath ?? env.TALEND_WORKSPACE ?? "";
  if (!path) return path;

  const ctx = platformContext ?? createPlatformContext();
  if (ctx.pathMode === "wsl-windows" && ctx.talendHostOs === "windows") {
    return windowsToWslPath(path);
  }
  return path;
}

export function getTalendBuildsDirForMcp(
  buildsDir?: string,
  platformContext?: PlatformContext,
): string {
  const env = getTalendMcpEnvCached();
  const path = buildsDir ?? env.TALEND_BUILDS_DIR ?? "";
  if (!path) return path;

  const ctx = platformContext ?? createPlatformContext();
  if (ctx.pathMode === "wsl-windows" && ctx.talendHostOs === "windows") {
    return windowsToWslPath(path);
  }
  return path;
}

export function getTalendStudioHomeForMcp(
  studioHome?: string,
  platformContext?: PlatformContext,
): string {
  const env = getTalendMcpEnvCached();
  const path = studioHome ?? env.TALEND_STUDIO_HOME ?? "";
  if (!path) return path;

  const ctx = platformContext ?? createPlatformContext();
  if (ctx.pathMode === "wsl-windows" && ctx.talendHostOs === "windows") {
    return windowsToWslPath(path);
  }
  return path;
}

export function getTalendPluginsDirForMcp(
  pluginsDir?: string,
  platformContext?: PlatformContext,
): string {
  const env = getTalendMcpEnvCached();
  const path = pluginsDir ?? env.TALEND_STUDIO_PLUGINS_DIR ?? "";
  if (!path) return path;

  const ctx = platformContext ?? createPlatformContext();
  if (ctx.pathMode === "wsl-windows" && ctx.talendHostOs === "windows") {
    return windowsToWslPath(path);
  }
  return path;
}