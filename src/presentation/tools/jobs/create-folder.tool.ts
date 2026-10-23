import { z } from "zod/v4";
import { createTalendFolder } from "../../../talend/job-crud";
import { resolveProjectPath } from "../../../talend/workspace";
import { ok, fail } from "../common/response";

const CreateFolderSchema = z.object({
  folderPath: z.string().describe("Ruta de carpeta dentro de process, por ejemplo carpeta_a/subcarpeta_b"),
});

export function createCreateFolderTool() {
  return {
    name: "talend_create_folder",
    description: "Crea una carpeta dentro de process para organizar jobs.",
    inputSchema: CreateFolderSchema,
    handler: async (input: z.infer<typeof CreateFolderSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return fail("NO_PROJECT", "No se detectó el proyecto de Talend: abre un proyecto en Studio o define TALEND_PROJECT.");
        const result = createTalendFolder(projectPath, input.folderPath);
        return ok({ folderPath: result.folderPath, directoryPath: result.directoryPath });
      } catch (err) {
        if (String(err).includes("inválida")) {
          return fail("INVALID_PATH", `Ruta de carpeta inválida: ${err}`);
        }
        return fail("CREATE_FOLDER_ERROR", `Error creando carpeta: ${err}`);
      }
    },
  };
}