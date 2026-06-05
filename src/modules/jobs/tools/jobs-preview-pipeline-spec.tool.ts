import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { PreviewPipelineSpecUseCase } from "../application/preview-pipeline-spec.usecase";
import type { PipelineSpec } from "../domain/pipeline-spec.types";

const PreviewPipelineSpecSchema = z.object({
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
  includeUnsetDefaults: z.boolean().optional().default(true),
});

const previewPipelineSpecUseCase = new PreviewPipelineSpecUseCase();

export function createJobsPreviewPipelineSpecTool() {
  return {
    name: "talend_jobs_preview_pipeline_spec",
    description: "Previsualiza un pipeline spec. Solo lectura.",
    inputSchema: PreviewPipelineSpecSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof PreviewPipelineSpecSchema>): Promise<CallToolResult> => {
      try {
        const result = await previewPipelineSpecUseCase.execute({
          spec: input.spec as PipelineSpec,
          includeUnsetDefaults: input.includeUnsetDefaults ?? true,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error previsualizando pipeline spec: ${err}` }],
          isError: true,
        };
      }
    },
  };
}