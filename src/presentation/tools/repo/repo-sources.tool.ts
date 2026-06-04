import { getCachedRepos } from "../../../infrastructure/git/git-repo";
import { ok, fail } from "../common/response";

export function createRepoSourcesTool() {
  return {
    name: "repo_sources",
    description: "Lista los repositorios en caché local.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const start = Date.now();
      try {
        const repos = await getCachedRepos();
        return ok({ repos }, { startTime: start });
      } catch (err) {
        return fail("REPO_SOURCES_ERROR", `Error obteniendo repos: ${err}`, { startTime: start });
      }
    },
  };
}