import { getRepoInfo, discoverTalendProject } from "../../../infrastructure/git/git-repo";
import { ok, fail } from "../common/response";

export function createRepoStatusTool() {
  return {
    name: "talend_repo_status",
    description: "Obtiene el estado de un repositorio Talend (branch, commit, remote).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Ruta al repositorio" },
      },
      required: ["repoPath"],
    },
    handler: async (input: { repoPath: string }) => {
      const start = Date.now();
      if (!input.repoPath) return fail("INVALID_INPUT", "Falta repoPath: la ruta al repositorio.", { startTime: start });
      try {
        const info = await getRepoInfo(input.repoPath);
        const project = await discoverTalendProject(input.repoPath);
        return ok({ ...info, project }, { startTime: start });
      } catch (err) {
        return fail("REPO_STATUS_ERROR", `Error obteniendo estado: ${err}`, { startTime: start });
      }
    },
  };
}