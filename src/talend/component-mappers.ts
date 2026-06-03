import { generateTalendId } from "./utils";

export function buildMapNodeData(uniqueName: string): Record<string, unknown> {
  // Estructura base de un tMap vacío pero válido para Talend Studio
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
    outputTables: {
      "@_sizeState": "INTERMEDIATE",
      "@_name": "out1"
    },
    inputTables: {
      "@_sizeState": "INTERMEDIATE",
      "@_name": "row1",
      "@_matchingMode": "ALL_ROWS",
      "@_lookupMode": "LOAD_ONCE"
    }
  };
}
