export type SchemaColumn = {
  name: string;
  type: string;
  nullable?: boolean;
  label?: string;
};

export type ComponentSchemaDefinition = {
  name: string;
  type: "input" | "output" | "rejected";
  schemaType: "dbtable" | "file" | "dynamic" | "built-in";
  columns?: SchemaColumn[];
};

export type ComponentExample = {
  title: string;
  description?: string;
  configuration: Record<string, string>;
  snippets?: string[];
};
