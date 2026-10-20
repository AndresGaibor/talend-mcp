import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { getSchemaMapping } from "../application/component-knowledge.container";

export const SchemaCompareSchema = z.object({
  schemaFromId: z.string().describe("Componente origen del schema"),
  schemaToId: z.string().describe("Componente destino del schema"),
});

export type SchemaCompareInput = z.infer<typeof SchemaCompareSchema>;

export type SchemaDifference = {
  type: "missing_in_source" | "missing_in_target" | "type_mismatch" | "name_mismatch";
  sourceColumn?: string;
  targetColumn?: string;
  details?: string;
};

function toDifferences(comparison: {
  matching: Array<{ columnName: string; fromType?: string; toType?: string }>;
  missingInOutput: Array<{ columnName: string; fromType?: string }>;
  extraInOutput: Array<{ columnName: string; toType?: string }>;
  typeMismatches: Array<{ columnName: string; fromType?: string; toType?: string }>;
}): SchemaDifference[] {
  const differences: SchemaDifference[] = [];

  for (const missing of comparison.missingInOutput) {
    differences.push({
      type: "missing_in_target",
      sourceColumn: missing.columnName,
      details: `La columna '${missing.columnName}' no existe en el schema destino.`,
    });
  }

  for (const extra of comparison.extraInOutput) {
    differences.push({
      type: "missing_in_source",
      targetColumn: extra.columnName,
      details: `La columna '${extra.columnName}' no existe en el schema origen.`,
    });
  }

  for (const mismatch of comparison.typeMismatches) {
    differences.push({
      type: "type_mismatch",
      sourceColumn: mismatch.columnName,
      targetColumn: mismatch.columnName,
      details: `Tipos distintos: '${mismatch.fromType ?? "?"}' vs '${mismatch.toType ?? "?"}'.`,
    });
  }

  return differences;
}

export function createSchemaCompareTool() {
  return {
    name: "talend_components_compare_schemas",
    description:
      "Compara los schemas de dos componentes y devuelve las diferencias de columnas y tipos. Solo lectura.",
    inputSchema: SchemaCompareSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: SchemaCompareInput): Promise<CallToolResult> => {
      try {
        const useCase = getSchemaMapping();
        const from = await useCase.extractSchema(input.schemaFromId);
        const to = await useCase.extractSchema(input.schemaToId);

        if (!from || !to) {
          const missing = !from ? input.schemaFromId : input.schemaToId;
          return {
            content: [{ type: "text", text: `No se encontró schema para '${missing}'.` }],
            isError: true,
          };
        }

        const comparison = useCase.compareSchemas(from, to);
        const differences = toDifferences(comparison);

        return {
          content: [
            {
              type: "text",
              text: `${differences.length} diferencia(s) entre '${input.schemaFromId}' y '${input.schemaToId}'.`,
            },
          ],
          structuredContent: {
            differences,
            matching: comparison.matching,
          } as any,
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error comparando los schemas: ${err}` }],
          isError: true,
        };
      }
    },
  };
}
