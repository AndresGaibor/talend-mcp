import { z } from "zod/v4";
import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { isProjectPath, resolveProjectPath } from "../../jobs/adapters/talend-job/project-path";
import { readProjectInventory, type InventoryItem, type ProjectInventory } from "../application/project-inventory";
import { detectConventions, findGaps, findReuseCandidates } from "../application/project-analysis";

const ProfileSchema = z.object({
  projectPath: z.string().optional().describe("Ruta del proyecto Talend. Si se omite, el proyecto abierto o configurado"),
  limit: z.number().int().positive().default(25).describe("Maximo de items por categoria del inventario (el total es el real)"),
  purpose: z.string().optional().describe("Proposito del job nuevo; busca candidatos de reutilizacion"),
});

/** Cuantos items de cada categoria se devuelven: el total es el real, los items se recortan a `limit`. */
function inventarioRecortado(inventory: ProjectInventory, limit: number): Record<string, { total: number; items: InventoryItem[] }> {
  const categorias: Record<string, InventoryItem[]> = {
    jobs: inventory.jobs,
    joblets: inventory.joblets,
    contexts: inventory.contexts,
    routines: inventory.routines,
  };
  for (const tipo of Object.keys(inventory.metadata).sort()) {
    categorias[`metadata/${tipo}`] = inventory.metadata[tipo] ?? [];
  }
  return Object.fromEntries(
    Object.entries(categorias).map(([nombre, items]) => [nombre, { total: items.length, items: items.slice(0, limit) }]),
  );
}

/** Fachada de solo lectura: inventario, convenciones, huecos y candidatos del proyecto, sin Studio. */
export function createProjectProfileTool() {
  return {
    name: "talend_project_profile",
    description:
      "Perfil de un proyecto Talend (solo lectura, sin Studio): inventario de jobs, joblets, contextos, rutinas y metadata, convenciones de nombres, huecos y candidatos de reutilizacion para un proposito.",
    inputSchema: ProfileSchema,
    handler: async (input: z.input<typeof ProfileSchema>) => {
      // Una ruta explicita que no es proyecto no cae al configurado: el llamador se equivoco de carpeta.
      if (input.projectPath && !isProjectPath(input.projectPath)) {
        return errorResult(
          "project-profile",
          "INVALID_PROJECT_PATH",
          `La ruta ${input.projectPath} no es un proyecto de Talend: no tiene carpeta process.`,
        );
      }
      let projectPath: string;
      try {
        projectPath = resolveProjectPath(input.projectPath);
      } catch (err) {
        return errorResult("project-profile", "NO_PROJECT", `No se detecto el proyecto de Talend: ${(err as Error).message}`);
      }
      try {
        const inventory = readProjectInventory(projectPath);
        const limit = input.limit ?? 25;
        const data = {
          projectPath,
          inventory: inventarioRecortado(inventory, limit),
          conventions: detectConventions(inventory),
          gaps: findGaps(inventory),
          reuseCandidates: input.purpose ? findReuseCandidates(inventory, input.purpose) : [],
        };
        return okResult(data, "project-profile");
      } catch (err) {
        return errorResult("project-profile", "PROFILE_ERROR", `Error leyendo el proyecto: ${(err as Error).message}`);
      }
    },
  };
}
