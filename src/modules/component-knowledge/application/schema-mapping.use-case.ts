import { inspectCatalogComponent } from "../../../talend/components/component-catalog-store";
import type { ComponentSchemaDefinition, SchemaColumn } from "../domain";

export type SchemaComparison = {
  matching: SchemaColumnMatch[];
  missingInOutput: SchemaColumnMatch[];
  extraInOutput: SchemaColumnMatch[];
  typeMismatches: SchemaColumnMatch[];
};

export type SchemaColumnMatch = {
  columnName: string;
  fromType?: string;
  toType?: string;
  matchType: "exact" | "name_only" | "type_only" | "missing" | "extra";
};

export type MappingSuggestion = {
  fromColumn: string;
  toColumn: string;
  confidence: number;
  reason: string;
};

export class SchemaMappingUseCase {
  async extractSchema(componentId: string): Promise<ComponentSchemaDefinition | null> {
    const component = await inspectCatalogComponent(componentId);
    if (!component) {
      return null;
    }

    const schemas: ComponentSchemaDefinition[] = [];

    if (component.schemas.hasInputSchema) {
      schemas.push({
        name: "InputSchema",
        type: "input",
        schemaType: "built-in",
        columns: [],
      });
    }

    if (component.schemas.hasOutputSchema) {
      schemas.push({
        name: "OutputSchema",
        type: "output",
        schemaType: "built-in",
        columns: [],
      });
    }

    if (component.schemas.hasDynamicSchema) {
      schemas.push({
        name: "DynamicSchema",
        type: "input",
        schemaType: "dynamic",
        columns: [],
      });
    }

    return schemas[0] ?? null;
  }

  compareSchemas(schemaFrom: ComponentSchemaDefinition, schemaTo: ComponentSchemaDefinition): SchemaComparison {
    const columnsFrom = schemaFrom.columns ?? [];
    const columnsTo = schemaTo.columns ?? [];

    const matching: SchemaColumnMatch[] = [];
    const missingInOutput: SchemaColumnMatch[] = [];
    const extraInOutput: SchemaColumnMatch[] = [];
    const typeMismatches: SchemaColumnMatch[] = [];

    const fromMap = new Map(columnsFrom.map(c => [c.name.toLowerCase(), c]));
    const toMap = new Map(columnsTo.map(c => [c.name.toLowerCase(), c]));

    for (const fromCol of columnsFrom) {
      const lowerName = fromCol.name.toLowerCase();
      const toCol = toMap.get(lowerName);

      if (!toCol) {
        missingInOutput.push({
          columnName: fromCol.name,
          fromType: fromCol.type,
          matchType: "missing",
        });
      } else if (fromCol.type === toCol.type) {
        matching.push({
          columnName: fromCol.name,
          fromType: fromCol.type,
          toType: toCol.type,
          matchType: "exact",
        });
      } else {
        typeMismatches.push({
          columnName: fromCol.name,
          fromType: fromCol.type,
          toType: toCol.type,
          matchType: "type_only",
        });
      }
    }

    for (const toCol of columnsTo) {
      const lowerName = toCol.name.toLowerCase();
      if (!fromMap.has(lowerName)) {
        extraInOutput.push({
          columnName: toCol.name,
          toType: toCol.type,
          matchType: "extra",
        });
      }
    }

    return { matching, missingInOutput, extraInOutput, typeMismatches };
  }

  suggestMappings(schemaFrom: ComponentSchemaDefinition, schemaTo: ComponentSchemaDefinition): MappingSuggestion[] {
    const columnsFrom = schemaFrom.columns ?? [];
    const columnsTo = schemaTo.columns ?? [];
    const suggestions: MappingSuggestion[] = [];

    for (const fromCol of columnsFrom) {
      const lowerName = fromCol.name.toLowerCase();

      const exactMatch = columnsTo.find(
        c => c.name.toLowerCase() === lowerName && c.type === fromCol.type
      );

      if (exactMatch) {
        suggestions.push({
          fromColumn: fromCol.name,
          toColumn: exactMatch.name,
          confidence: 1.0,
          reason: "Nombre y tipo coinciden exactamente",
        });
        continue;
      }

      const nameMatch = columnsTo.find(c => c.name.toLowerCase() === lowerName);
      if (nameMatch) {
        suggestions.push({
          fromColumn: fromCol.name,
          toColumn: nameMatch.name,
          confidence: 0.7,
          reason: `Nombre coincide (tipos diferentes: ${fromCol.type} vs ${nameMatch.type})`,
        });
        continue;
      }

      const typeMatch = columnsTo.find(c => c.type === fromCol.type);
      if (typeMatch) {
        suggestions.push({
          fromColumn: fromCol.name,
          toColumn: typeMatch.name,
          confidence: 0.4,
          reason: `Tipo coincide (${fromCol.type}) pero nombre diferente`,
        });
      }
    }

    return suggestions;
  }
}