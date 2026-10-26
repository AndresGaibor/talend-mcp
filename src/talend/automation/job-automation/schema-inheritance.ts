import type { TalendJobSpec } from "./types";

/** Schema que un componente recibe del flujo, si no declara el suyo. */
export type InheritedSchema = {
  name: string;
  connector: string;
  columns: Array<{ name: string; type: string; nullable?: boolean; length?: number; precision?: number }>;
};

/**
 * Schema que un componente recibe del flujo, si no declara el suyo.
 *
 * Un `tLogRow` al final de un flujo no declara schema, pero Talend si lo
 * necesita: el parametro `LENGTHS` se arma con las columnas que le llegan.
 * Sin schema, el job falla al generar codigo con `NumberFormatException`.
 */
export function inheritSchemaFromSource(componentId: string, spec: TalendJobSpec): InheritedSchema | undefined {
  const incoming = spec.connections.filter((c) => c.target === componentId && c.type === "FLOW");
  for (const connection of incoming) {
    const source = spec.components.find((c) => c.id === connection.source);
    if (!source?.schema || source.schema.length === 0) {
      continue;
    }
    return {
      // El metadata del componente que hereda el schema se llama como el
      // componente, no como la primera columna.
      name: componentId,
      connector: "FLOW",
      columns: source.schema.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        length: col.length,
        precision: col.precision,
      })),
    };
  }
  return undefined;
}
