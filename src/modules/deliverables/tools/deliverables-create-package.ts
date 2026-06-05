import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { CreatePackageUseCase } from "../application/create-package.usecase";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const DeliverableFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  sizeBytes: z.number(),
  type: z.string(),
  modifiedAt: z.string().or(z.date()),
});

const CreatePackageSchema = z.object({
  name: z.string().describe("Nombre del paquete"),
  version: z.string().describe("Versión del paquete"),
  files: z.array(DeliverableFileSchema).describe("Archivos a incluir en el paquete"),
  requiresConfirmation: z.boolean().optional().default(true).describe("Requiere confirmación antes de crear"),
});

const createPackageUseCase = new CreatePackageUseCase();

export function createDeliverablesCreatePackageTool() {
  return {
    name: "talend_deliverables_create_package",
    description: "Crea un paquete de deliverable con los archivos validados. Requiere confirmación.",
    inputSchema: CreatePackageSchema,
    annotations: {
      readOnly: false,
      destructive: false,
      confirmationRequired: true,
    },
    handler: async (input: z.infer<typeof CreatePackageSchema>): Promise<CallToolResult> => {
      try {
        const pkg = await createPackageUseCase.execute({
          name: input.name,
          version: input.version,
          files: input.files.map((f) => ({ ...f, modifiedAt: new Date(f.modifiedAt) })),
          requiresConfirmation: input.requiresConfirmation,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(pkg, null, 2) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error creando paquete: ${err}` }],
          isError: true,
        };
      }
    },
  };
}