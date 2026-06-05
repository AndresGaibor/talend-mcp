import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { CreateJobUseCase } from "../application/create-job.usecase";
import { TalendXmlJobRepository } from "../adapters/talend-xml-job.repository";

const CreateJobSchema = z.object({
  name: z.string().describe("Nombre del job"),
  path: z.string().describe("Ruta donde crear el job"),
  description: z.string().optional().describe("Descripción del job"),
  status: z.enum(["development", "production", "archived"]).optional().default("development").describe("Estado del job"),
});

const repository = new TalendXmlJobRepository();
const createJobUseCase = new CreateJobUseCase(repository);

export function createJobsCreateTool() {
  return {
    name: "talend_jobs_create",
    description: "Crea un nuevo job. Requiere confirmación.",
    inputSchema: CreateJobSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof CreateJobSchema>): Promise<CallToolResult> => {
      try {
        const job = await createJobUseCase.execute({
          name: input.name,
          path: input.path,
          description: input.description,
          status: input.status ?? "development",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error creando job: ${err}` }],
          isError: true,
        };
      }
    },
  };
}