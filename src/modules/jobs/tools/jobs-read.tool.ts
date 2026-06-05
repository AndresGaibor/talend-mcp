import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ReadJobUseCase } from "../application/read-job.usecase";
import { TalendXmlJobRepository } from "../adapters/talend-xml-job.repository";

const ReadJobSchema = z.object({
  jobId: z.string().describe("ID del job a leer"),
  includeComponents: z.boolean().optional().default(true).describe("Incluir componentes"),
  includeConnections: z.boolean().optional().default(true).describe("Incluir conexiones"),
});

const repository = new TalendXmlJobRepository();
const readJobUseCase = new ReadJobUseCase(repository);

export function createJobsReadTool() {
  return {
    name: "talend_jobs_read",
    description: "Lee un job específico por ID. Solo lectura.",
    inputSchema: ReadJobSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof ReadJobSchema>): Promise<CallToolResult> => {
      try {
        const job = await readJobUseCase.execute(input.jobId, {
          includeComponents: input.includeComponents,
          includeConnections: input.includeConnections,
        });
        if (!job) {
          return {
            content: [{ type: "text", text: `Job ${input.jobId} no encontrado` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error leyendo job: ${err}` }],
          isError: true,
        };
      }
    },
  };
}