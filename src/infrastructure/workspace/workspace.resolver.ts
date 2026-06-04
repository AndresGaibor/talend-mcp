import { getActiveRepoPath as getRepoPath } from "../../talend/workspace";

export { setActiveRepo, clearActiveRepo, getActiveRepoPath, isRepoMode, resolveWorkspaceFromProject, discoverProjectPathFromWorkspace, getConfiguredProjectPath } from "../../talend/workspace";

export function getActiveProjectName(): string | undefined {
  const path = getRepoPath();
  if (!path) return undefined;
  return path.replace(/\\/g, "/").split("/").pop();
}
