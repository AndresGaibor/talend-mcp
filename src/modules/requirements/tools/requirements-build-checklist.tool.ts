import { z } from "zod/v4";
import type { McpToolAnnotation } from "../../../server/adapt-tool";
import { ok, fail } from "../../../presentation/tools/common/response";

export const BuildChecklistSchema = z.object({
  requirements: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    required: z.boolean(),
    severity: z.enum(["error", "warning", "info"]),
  })).describe("Lista de requisitos para generar el checklist"),
});

export type BuildChecklistInput = z.infer<typeof BuildChecklistSchema>;

export function createRequirementsBuildChecklistTool() {
  return {
    name: "talend_task_build_execution_plan",
    description: "Construye un checklist de requisitos técnicos con items auditables.",
    inputSchema: BuildChecklistSchema,
    annotations: {
      readOnly: true,
    } as McpToolAnnotation,
    handler: async (input: BuildChecklistInput) => {
      const start = Date.now();
      try {
        return ok(
          {
            checklistId: `checklist_${Date.now()}`,
            items: input.requirements.map((req, idx) => ({
              id: req.id || `item_${idx}`,
              label: req.label,
              description: req.description,
              required: req.required,
              checked: false,
              severity: req.severity,
            })),
            totalItems: input.requirements.length,
            requiredItems: input.requirements.filter(r => r.required).length,
          },
          { startTime: start }
        );
      } catch (err) {
        return fail("CHECKLIST_BUILD_ERROR", `Error construyendo checklist: ${err}`, { startTime: start });
      }
    },
  };
}