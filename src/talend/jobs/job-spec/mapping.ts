import type { ComponentSpec } from "../../job-generator";

export const DEFAULT_POS_X = 160;
export const DEFAULT_POS_Y = 96;
export const POS_X_STEP = 300;
export const POS_Y_STEP = 180;

export function generatePositions(index: number): { posX: number; posY: number } {
  return {
    posX: DEFAULT_POS_X + index * POS_X_STEP,
    posY: DEFAULT_POS_Y + index * POS_Y_STEP,
  };
}

export function inferTalendType(csvType: string | undefined): string {
  switch (csvType) {
    case "number": return "id_Double";
    case "boolean": return "id_Boolean";
    case "date": return "id_Date";
    default: return "id_String";
  }
}

export function buildTechnicalColumns(technicalColumns: Array<{ name: string; value: string }> | undefined): ComponentSpec["schema"] extends { columns: infer C } ? C : never[] {
  if (!technicalColumns || technicalColumns.length === 0) {
    return [] as unknown as ComponentSpec["schema"] extends { columns: infer C } ? C : never[];
  }
  return technicalColumns.map((tc) => ({
    name: tc.name,
    type: tc.name === "_load_ts" ? "id_Date" : "id_String",
    length: tc.name === "_load_ts" ? undefined : 255,
    nullable: false,
    key: false,
  })) as unknown as ComponentSpec["schema"] extends { columns: infer C } ? C : never[];
}
