import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ValidatePipelineSpecUseCase } from "../application/validate-pipeline-spec.usecase";
import type { PipelineSpec } from "../domain/pipeline-spec.types";

const ValidatePipelineSpecSchema = z.object({
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
  strict: z.boolean().optional().default(false),
});

const validatePipelineSpecUseCase = new ValidatePipelineSpecUseCase();

export function createJobsValidatePipelineSpecTool() {
  return {
    name: "talend_jobs_validate_pipeline_spec",
    description: "Valida un pipeline spec. Solo lectura.",
    inputSchema: ValidatePipelineSpecSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: z.infer<typeof ValidatePipelineSpecSchema>): Promise<CallToolResult> => {
      try {
        const result = await validatePipelineSpecUseCase.execute({
          spec: input.spec as PipelineSpec,
          strict: input.strict ?? false,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando pipeline spec: ${err}` }],
          isError: true,
        };
      }
    },
  };
}