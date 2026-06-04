import { okResult, errorResult } from "../common/result";

interface RepositoryContext {
  name: string;
  parameters: { name: string; type?: string; value?: string; prompt?: string; }[];
}

async function listRepositoryContexts(projectPath: string): Promise<RepositoryContext[]> {
  return [];
}

export function createListRepositoryContextsTool() {
  return {
    name: "list_repository_contexts",
    description: "Lista todos los contextos de repositorio en un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta al proyecto Talend" },
      },
      required: ["projectPath"],
    },
    handler: async (input: { projectPath: string }) => {
      try {
        const contexts = await listRepositoryContexts(input.projectPath);
        return okResult({ contexts }, "list-repository-contexts");
      } catch (err) {
        return errorResult("list-repository-contexts", "LIST_REPO_CONTEXTS_ERROR", `Error listando contextos: ${err}`);
      }
    },
  };
}