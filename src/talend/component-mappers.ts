/** Nombres de las tablas de un tMap: las conexiones que entran y las que salen. */
export type MapTables = { inputs: string[]; outputs: string[] };

/**
 * Un tMap sin ninguna conexion conserva una tabla de entrada y una de salida por defecto, como el que crea Studio
 * al soltarlo en el lienzo.
 */
export const DEFAULT_MAP_TABLES: MapTables = { inputs: ["row1"], outputs: ["out1"] };

/**
 * Datos del mapper de un tMap vacio pero valido para Talend Studio.
 *
 * Studio enlaza cada conexion con una tabla del mapper por nombre: la tabla de salida se llama como la conexion que
 * sale y la de entrada como la que entra. Si no coinciden, al abrir el Job Studio avisa de errores en esas conexiones
 * ("Some errors appear after the migration in the following connections").
 */
export function buildMapNodeData(tables: MapTables = DEFAULT_MAP_TABLES): Record<string, unknown> {
  const inputs = tables.inputs.length > 0 ? tables.inputs : DEFAULT_MAP_TABLES.inputs;
  const outputs = tables.outputs.length > 0 ? tables.outputs : DEFAULT_MAP_TABLES.outputs;
  const inputTables = inputs.map((name, index) => ({
    "@_sizeState": "INTERMEDIATE",
    "@_name": name,
    // La primera entrada es la principal; las demas son lookups.
    "@_matchingMode": index === 0 ? "ALL_ROWS" : "UNIQUE_MATCH",
    "@_lookupMode": "LOAD_ONCE",
  }));
  const outputTables = outputs.map((name) => ({ "@_sizeState": "INTERMEDIATE", "@_name": name }));
  return {
    "@_xsi:type": "TalendMapper:MapperData",
    uiProperties: {
      "@_shellMaximized": "true"
    },
    varTables: {
      "@_sizeState": "INTERMEDIATE",
      "@_name": "Var",
      "@_minimized": "true"
    },
    outputTables: outputTables.length === 1 ? outputTables[0] : outputTables,
    inputTables: inputTables.length === 1 ? inputTables[0] : inputTables,
  };
}
