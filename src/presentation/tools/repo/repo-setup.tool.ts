import { parseSource, cloneRepo, discoverTalendProject, getCacheDir } from "../../../infrastructure/git/git-repo";
import { ok, fail } from "../common/response";
import { join } from "node:path";

export function createRepoSetupTool() {
  return {
    name: "repo_setup",
    description: "Clona o configura un repositorio Talend desde una fuente remota o local.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "URL git, path local o格式 'owner/repo'" },
        branch: { type: "string", description: "Rama opcional a clonar" },
      },
      required: ["source"],
    },
    handler: async (input: { source: string; branch?: string }) => {
      const start = Date.now();
      try {
        const parsed = parseSource(input.source);
        if (parsed.type === "local") {
          const project = await discoverTalendProject(parsed.path);
          return ok({ type: "local", path: parsed.path, project }, { startTime: start });
        }
        const cacheDir = getCacheDir();
        const targetDir = join(cacheDir, parsed.name);
        await cloneRepo(input.source, targetDir, input.branch);
        const project = await discoverTalendProject(targetDir);
        return ok({ type: "remote", url: parsed.url, path: targetDir, project }, { startTime: start });
      } catch (err) {
        return fail("REPO_SETUP_ERROR", `Error configurando repo: ${err}`, { startTime: start });
      }
    },
  };
}