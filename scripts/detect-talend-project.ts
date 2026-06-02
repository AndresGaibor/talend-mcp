import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../src/talend/workspace";

const projectPath = getConfiguredProjectPath();

if (!projectPath) {
  console.log("NO_DETECTED");
  process.exit(1);
}

const workspace = resolveWorkspaceFromProject(projectPath);
console.log(projectPath);
console.log(workspace.projectName);
console.log(workspace.workspacePath);
