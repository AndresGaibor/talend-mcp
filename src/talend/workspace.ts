import { dirname, join } from "node:path";
import type { TalendWorkspace } from "./types";

export function resolveWorkspaceFromProject(projectPath: string): TalendWorkspace {
  const projectName = projectPath.split("/").filter(Boolean).at(-1) ?? "";
  const workspacePath = dirname(dirname(projectPath));
  return {
    workspacePath,
    projectPath,
    projectName,
    metadataPath: join(workspacePath, ".metadata"),
  };
}

export function getConfiguredProjectPath(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.TALEND_PROJECT;
}