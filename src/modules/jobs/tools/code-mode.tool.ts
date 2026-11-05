import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { okResult, errorResult } from "../../../presentation/tools/common/result";

const SearchSchema = z.object({
  query: z.string().describe("Texto a buscar (crear y configurar componentes tMap...)"),
  limit: z.number().optional().default(10),
});

const DescribeOperationSchema = z.object({ operation: z.string().describe("Nombre de la operación (talend_job_configure_node...)") });

const ExecuteSchema = z.object({
  operation: z.string().describe("Nombre de la operación registrada"),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
  confirm: z.boolean().optional().describe("Confirmar operaciones destructivas"),
});

let registry: Map<string, { description: string; handler: (input: unknown) => Promise<unknown> }> | null = null;

export function setCodeModeRegistry(map: Map<string, { description: string; handler: (input: unknown) => Promise<unknown> }>): void {
  registry = map;
}

/** Code Mode (lado cliente): search / describe / execute sobre el catálogo registrado. Solo operaciones autorizadas. */
export function createCodeModeTools() {
  const all = new Map<string, { description: string; handler: (input: unknown) => Promise<unknown> }>();
  const search = {
    name: "talend_search",
    description: "Busca operaciones del catálogo por texto (Code Mode).",
    inputSchema: SearchSchema,
    handler: async (input: z.infer<typeof SearchSchema>): Promise<CallToolResult> => {
      const items = registry ? [...registry.entries()] : all.size > 0 ? [...all.entries()] : [];
      const q = input.query.toLowerCase();
      const hits = items.filter(([name, v]) => name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)).slice(0, input.limit ?? 10);
      return okResult({ query: input.query, results: hits.map(([name, v]) => ({ operation: name, description: v.description })) }, "codemode-search") as unknown as CallToolResult;
    },
  };

  const describe = {
    name: "talend_describe",
    description: "Describe una operación registrada (Code Mode).",
    inputSchema: DescribeOperationSchema,
    handler: async (input: z.infer<typeof DescribeOperationSchema>): Promise<CallToolResult> => {
      const entry = registry?.get(input.operation);
      if (!entry) return errorResult("codemode-describe", "NOT_FOUND", `Operación no registrada: ${input.operation}`) as unknown as CallToolResult;
      return okResult({ operation: input.operation, description: entry.description, registered: true }, "codemode-describe") as unknown as CallToolResult;
    },
  };

  const execute = {
    name: "talend_execute",
    description: "Ejecuta una operación registrada y autorizada (Code Mode). Pasa por validación y autorización.",
    inputSchema: ExecuteSchema,
    handler: async (input: z.infer<typeof ExecuteSchema>): Promise<CallToolResult> => {
      const entry = registry?.get(input.operation);
      if (!entry) return errorResult("codemode-execute", "NOT_FOUND", `Operación no registrada: ${input.operation}`) as unknown as CallToolResult;
      const result = await entry.handler(input.arguments ?? {});
      return okResult(result, "codemode-execute") as unknown as CallToolResult;
    },
  };

  return [search, describe, execute];
}
