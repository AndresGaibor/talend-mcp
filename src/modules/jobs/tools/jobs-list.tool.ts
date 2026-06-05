import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ListJobsUseCase } from "../application/list-jobs.usecase";
import { TalendXmlJobRepository } from "../adapters/talend-xml-job.repository";
import { okResult, errorResult, type Confidence } from "../../../presentation/tools/common/result";

const ListJobsSchema = z.object({
  path: z.string().optional().describe("Ruta para filtrar jobs"),
  status: z.enum(["development", "production", "archived"]).optional().describe("Estado del job"),
  limit: z.number().optional().default(50).describe("Límite de resultados"),
  offset: z.number().optional().default(0).describe("Offset para paginación"),
});

const repository = new TalendXmlJobRepository();
const listJobsUseCase = new ListJobsUseCase(repository);

export function createJobsListTool() {
  return {
    name: "talend_jobs_list",
    description: "Lista todos los jobs disponibles. Solo lectura.",
    inputSchema: ListJobsSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof ListJobsSchema>): Promise<CallToolResult> => {
      try {
          const jobs = await listJobsUseCase.execute({
            path: input.path,
            status: input.status,
            limit: input.limit ?? 50,
            offset: input.offset ?? 0,
          });
          const result = okResult(jobs, "talend_jobs_list");
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: false,
          };
        } catch (err) {
          const result = errorResult("talend_jobs_list", "LIST_ERROR", `Error listando jobs: ${err}`);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            isError: true,
          };
        }
    },
  };
}