import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { PatchComponentUseCase } from "../application/patch-component.usecase";
import { TalendXmlJobRepository } from "../adapters/talend-xml-job.repository";

const PatchComponentSchema = z.object({
  jobId: z.string().describe("ID del job"),
  componentId: z.string().describe("ID del componente a modificar"),
  configuration: z.record(z.string(), z.unknown()).describe("Configuración a aplicar"),
});

const repository = new TalendXmlJobRepository();
const patchComponentUseCase = new PatchComponentUseCase(repository);

export function createJobsPatchComponentTool() {
  return {
    name: "talend_jobs_patch_component",
    description: "Modifica la configuración de un componente en un job. Requiere confirmación.",
    inputSchema: PatchComponentSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof PatchComponentSchema>): Promise<CallToolResult> => {
      try {
        const job = await patchComponentUseCase.execute({
          jobId: input.jobId,
          componentId: input.componentId,
          configuration: input.configuration,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error modificando componente: ${err}` }],
          isError: true,
        };
      }
    },
  };
}