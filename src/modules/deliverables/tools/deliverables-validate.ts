import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { ValidateChecklistUseCase } from "../application/validate-checklist.usecase";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  required: z.boolean(),
  checked: z.boolean(),
  severity: z.enum(["error", "warning", "info"]),
});

const ValidateChecklistSchema = z.object({
  checklistId: z.string().describe("ID único del checklist"),
  items: z.array(ChecklistItemSchema).describe("Items del checklist a validar"),
});

const validateChecklistUseCase = new ValidateChecklistUseCase();

export function createDeliverablesValidateTool() {
  return {
    name: "talend_deliverables_validate",
    description: "Valida un checklist de deliverable contra los archivos recolectados",
    inputSchema: ValidateChecklistSchema,
    annotations: {
      readOnly: true,
      destructive: false,
    },
    handler: async (input: z.infer<typeof ValidateChecklistSchema>): Promise<CallToolResult> => {
      try {
        const checklist = await validateChecklistUseCase.execute({
          checklistId: input.checklistId,
          items: input.items,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(checklist, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error validando checklist: ${err}` }],
          isError: true,
        };
      }
    },
  };
}