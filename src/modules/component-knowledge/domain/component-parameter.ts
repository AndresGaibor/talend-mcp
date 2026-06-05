export type ComponentParameter = {
  name: string;
  displayName?: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "enum"
    | "file"
    | "directory"
    | "schema"
    | "table"
    | "connection"
    | "password"
    | "unknown";
  required: boolean;
  defaultValue?: string;
  possibleValues?: string[];
  category?: "basic" | "advanced" | "dynamic" | "hidden";
  description?: string;
  safeToEdit: boolean;
  riskLevel: "low" | "medium" | "high";
};
