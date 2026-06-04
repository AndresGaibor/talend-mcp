import { listProjectContexts } from "../../../infrastructure/repositories/context-xml.repository";
import { ok, fail } from "../common/response";

export function createListProjectContextsTool() {
  return {
    name: "list_project_contexts",
    description: "Lista los contextos definidos en los jobs de un proyecto Talend.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Ruta al proyecto Talend" },
      },
      required: ["projectPath"],
    },
    handler: async (input: { projectPath: string }) => {
      const start = Date.now();
      try {
        const contexts = await listProjectContexts(input.projectPath);
        return ok({ contexts }, { startTime: start });
      } catch (err) {
        return fail("LIST_PROJECT_CONTEXTS_ERROR", `Error listando contextos: ${err}`, { startTime: start });
      }
    },
  };
}