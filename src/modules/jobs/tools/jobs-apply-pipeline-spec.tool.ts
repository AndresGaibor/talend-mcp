import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ApplyPipelineSpecUseCase } from "../application/apply-pipeline-spec.usecase";
import { TalendXmlJobRepository } from "../adapters/talend-xml-job.repository";
import type { PipelineSpec } from "../domain/pipeline-spec.types";
import type { IStudioBridge } from "../ports/studio-bridge.port";

const ApplyPipelineSpecSchema = z.object({
  jobId: z.string().describe("ID del job donde aplicar el pipeline"),
  spec: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    stages: z.array(z.object({
      id: z.string(),
      name: z.string(),
      components: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        configuration: z.record(z.string(), z.unknown()),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
      })),
      connections: z.array(z.object({
        id: z.string(),
        sourceComponentId: z.string(),
        targetComponentId: z.string(),
        schema: z.record(z.string(), z.unknown()).optional(),
      })).optional(),
    })),
  }),
  overwrite: z.boolean().optional().default(false),
});

const repository = new TalendXmlJobRepository();
const studioBridge: IStudioBridge = {
  async executeCommand() {
    return { success: false, error: "Studio bridge not implemented" };
  },
  async isAvailable() {
    return false;
  },
};
const applyPipelineSpecUseCase = new ApplyPipelineSpecUseCase(repository, studioBridge);

export function createJobsApplyPipelineSpecTool() {
  return {
    name: "talend_jobs_apply_pipeline_spec",
    description: "Aplica un pipeline spec a un job. Requiere confirmación.",
    inputSchema: ApplyPipelineSpecSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof ApplyPipelineSpecSchema>): Promise<CallToolResult> => {
      try {
        const job = await applyPipelineSpecUseCase.execute({
          jobId: input.jobId,
          spec: input.spec as PipelineSpec,
          overwrite: input.overwrite ?? false,
        });
        const lastSlash = Math.max(job.path.lastIndexOf("/"), job.path.lastIndexOf("\\"));
        const folderPath = lastSlash !== -1 ? job.path.substring(0, lastSlash) : ".";
        const responseData = {
          jobId: job.id,
          itemPath: job.path,
          propertiesPath: job.path.replace(/\.item$/, ".properties"),
          folderPath: folderPath,
          label: job.name,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(responseData, null, 2) }],
          structuredContent: responseData as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error aplicando pipeline spec: ${err}` }],
          isError: true,
        };
      }
    },
  };
}