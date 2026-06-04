import { pullRepo, discoverTalendProject } from "../../../infrastructure/git/git-repo";
import { ok, fail } from "../common/response";

export function createRepoPullTool() {
  return {
    name: "repo_pull",
    description: "Hace pull en un repositorio y descubre el proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Ruta al repositorio" },
      },
      required: ["repoPath"],
    },
    handler: async (input: { repoPath: string }) => {
      const start = Date.now();
      try {
        const pullResult = await pullRepo(input.repoPath);
        const project = await discoverTalendProject(input.repoPath);
        return ok({ ...pullResult, project }, { startTime: start });
      } catch (err) {
        return fail("REPO_PULL_ERROR", `Error haciendo pull: ${err}`, { startTime: start });
      }
    },
  };
}