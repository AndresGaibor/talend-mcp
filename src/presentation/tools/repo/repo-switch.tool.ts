import { discoverTalendProject } from "../../../infrastructure/git/git-repo";
import { ok, fail } from "../common/response";

export function createRepoSwitchTool() {
  return {
    name: "repo_switch",
    description: "Cambia a un repositorio ya clonado y descubre el proyecto Talend.",
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
        const project = await discoverTalendProject(input.repoPath);
        return ok({ repoPath: input.repoPath, project }, { startTime: start });
      } catch (err) {
        return fail("REPO_SWITCH_ERROR", `Error cambiando repo: ${err}`, { startTime: start });
      }
    },
  };
}