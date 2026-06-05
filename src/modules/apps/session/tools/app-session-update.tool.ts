import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { UpdateSessionUseCase } from "../application/update-session.usecase";
import { FileAppSessionRepository } from "../adapters/file-app-session.repository";

const UpdateSessionSchema = z.object({
  sessionId: z.string().describe("ID de la sesión a actualizar"),
  projectPath: z.string().optional().describe("Ruta del proyecto"),
  selectedJob: z.string().optional().describe("Job seleccionado"),
  datasetFolder: z.string().optional().describe("Carpeta de datasets"),
  datasetMappings: z.array(z.unknown()).optional().describe("Mappings de datasets"),
  pipelineSpec: z.unknown().optional().describe("Especificación del pipeline"),
  validationReport: z.unknown().optional().describe("Reporte de validación"),
  lastRunId: z.string().optional().describe("ID del último run"),
  evidenceFiles: z.array(z.string()).optional().describe("Archivos de evidencia"),
});

const repository = new FileAppSessionRepository();
const updateSessionUseCase = new UpdateSessionUseCase(repository);

export function createAppSessionUpdateTool() {
  return {
    name: "talend_app_session_update",
    description: "Actualiza una sesión de app existente.",
    inputSchema: UpdateSessionSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: false,
    },
    handler: async (input: z.infer<typeof UpdateSessionSchema>): Promise<CallToolResult> => {
      try {
        const session = await updateSessionUseCase.execute(input.sessionId, {
          projectPath: input.projectPath,
          selectedJob: input.selectedJob,
          datasetFolder: input.datasetFolder,
          datasetMappings: input.datasetMappings,
          pipelineSpec: input.pipelineSpec,
          validationReport: input.validationReport,
          lastRunId: input.lastRunId,
          evidenceFiles: input.evidenceFiles,
        });
        if (!session) {
          return {
            content: [{ type: "text", text: `Sesión ${input.sessionId} no encontrada` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Sesión ${session.id} actualizada.` }],
          structuredContent: session as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error actualizando sesión: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
