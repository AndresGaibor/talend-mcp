import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { SchemaMappingUseCase } from "../../modules/component-knowledge/application/schema-mapping.use-case";

export const schemaTools = [
  {
    name: "talend_schema_extract_from_component",
    description: "Extrae el schema de un componente del catálogo.",
    inputSchema: z.object({
      componentId: z.string().describe("ID o nombre del componente"),
    }),
    handler: async ({ componentId }: { componentId: string }) => {
      const useCase = new SchemaMappingUseCase();
      const schema = await useCase.extractSchema(componentId);

      if (!schema) {
        return bridgeFail({
          ok: false,
          source: "catalog",
          confidence: "low",
          endpoint: "/schema/extract",
          error: { code: "NOT_FOUND", message: `Componente no encontrado: ${componentId}` },
        });
      }

      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/schema/extract",
        data: { componentId, schema },
      });
    },
  },
  {
    name: "talend_schema_compare",
    description: "Compara dos schemas de componentes.",
    inputSchema: z.object({
      schemaFromId: z.string().describe("ID del schema de origen"),
      schemaToId: z.string().describe("ID del schema de destino"),
      schemaFromColumns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Columnas del schema de origen (si no se provee, usa el catálogo)"),
      schemaToColumns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Columnas del schema de destino (si no se provee, usa el catálogo)"),
    }),
    handler: async ({ schemaFromId, schemaToId, schemaFromColumns, schemaToColumns }: {
      schemaFromId: string;
      schemaToId: string;
      schemaFromColumns?: Array<{ name: string; type: string; nullable?: boolean; label?: string }>;
      schemaToColumns?: Array<{ name: string; type: string; nullable?: boolean; label?: string }>;
    }) => {
      const useCase = new SchemaMappingUseCase();

      if (schemaFromColumns && schemaToColumns) {
        const schemaFrom = {
          name: "InputSchema",
          type: "input" as const,
          schemaType: "built-in" as const,
          columns: schemaFromColumns,
        };
        const schemaTo = {
          name: "OutputSchema",
          type: "output" as const,
          schemaType: "built-in" as const,
          columns: schemaToColumns,
        };

        const comparison = useCase.compareSchemas(schemaFrom, schemaTo);

        return bridgeOk({
          ok: true,
          source: "user-provided",
          confidence: "high",
          endpoint: "/schema/compare",
          data: {
            schemaFromId,
            schemaToId,
            comparison,
            summary: {
              matching: comparison.matching.length,
              missingInOutput: comparison.missingInOutput.length,
              extraInOutput: comparison.extraInOutput.length,
              typeMismatches: comparison.typeMismatches.length,
            },
          },
        });
      }

      const schemaFrom = await useCase.extractSchema(schemaFromId);
      const schemaTo = await useCase.extractSchema(schemaToId);

      if (!schemaFrom || !schemaTo) {
        return bridgeFail({
          ok: false,
          source: "catalog",
          confidence: "low",
          endpoint: "/schema/compare",
          error: {
            code: "NOT_FOUND",
            message: `Uno o ambos schemas no fueron encontrados: ${schemaFromId}, ${schemaToId}`,
          },
        });
      }

      const comparison = useCase.compareSchemas(schemaFrom, schemaTo);

      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/schema/compare",
        data: {
          schemaFromId,
          schemaToId,
          comparison,
          summary: {
            matching: comparison.matching.length,
            missingInOutput: comparison.missingInOutput.length,
            extraInOutput: comparison.extraInOutput.length,
            typeMismatches: comparison.typeMismatches.length,
          },
        },
      });
    },
  },
  {
    name: "talend_schema_suggest_mapping",
    description: "Sugiere mapeos automáticos entre dos schemas.",
    inputSchema: z.object({
      schemaFromId: z.string().describe("ID del schema de origen"),
      schemaToId: z.string().describe("ID del schema de destino"),
      schemaFromColumns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Columnas del schema de origen"),
      schemaToColumns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Columnas del schema de destino"),
    }),
    handler: async ({ schemaFromId, schemaToId, schemaFromColumns, schemaToColumns }: {
      schemaFromId: string;
      schemaToId: string;
      schemaFromColumns?: Array<{ name: string; type: string; nullable?: boolean; label?: string }>;
      schemaToColumns?: Array<{ name: string; type: string; nullable?: boolean; label?: string }>;
    }) => {
      const useCase = new SchemaMappingUseCase();

      if (schemaFromColumns && schemaToColumns) {
        const schemaFrom = {
          name: "InputSchema",
          type: "input" as const,
          schemaType: "built-in" as const,
          columns: schemaFromColumns,
        };
        const schemaTo = {
          name: "OutputSchema",
          type: "output" as const,
          schemaType: "built-in" as const,
          columns: schemaToColumns,
        };

        const suggestions = useCase.suggestMappings(schemaFrom, schemaTo);

        return bridgeOk({
          ok: true,
          source: "user-provided",
          confidence: "high",
          endpoint: "/schema/suggest-mapping",
          data: { suggestions },
        });
      }

      const schemaFrom = await useCase.extractSchema(schemaFromId);
      const schemaTo = await useCase.extractSchema(schemaToId);

      if (!schemaFrom || !schemaTo) {
        return bridgeFail({
          ok: false,
          source: "catalog",
          confidence: "low",
          endpoint: "/schema/suggest-mapping",
          error: {
            code: "NOT_FOUND",
            message: `Uno o ambos schemas no fueron encontrados: ${schemaFromId}, ${schemaToId}`,
          },
        });
      }

      const suggestions = useCase.suggestMappings(schemaFrom, schemaTo);

      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/schema/suggest-mapping",
        data: { suggestions },
      });
    },
  },
];