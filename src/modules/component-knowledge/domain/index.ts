export type TalendComponentDefinition = {
  id: string;
  name: string;
  family: string;
  paletteCategory?: string;
  version?: string;
  source: {
    pluginId?: string;
    pluginPath?: string;
    descriptorPath?: string;
    scannedAt: string;
  };
  description?: string;
  icon?: string;
  connectors: ComponentConnector[];
  parameters: ComponentParameter[];
  schemas: ComponentSchemaDefinition[];
  examples: ComponentExample[];
  commonUseCases: ComponentUseCase[];
  relatedComponents: string[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
};

export type ComponentConnector = {
  name: string;
  type:
    | "FLOW_MAIN"
    | "ITERATE"
    | "ON_COMPONENT_OK"
    | "ON_COMPONENT_ERROR"
    | "RUN_IF"
    | "LOOKUP"
    | "REJECT"
    | "UNKNOWN";
  direction: "input" | "output";
  required?: boolean;
  maxConnections?: number;
};

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

export type ComponentSchemaDefinition = {
  name: string;
  type: "input" | "output" | "rejected";
  schemaType: "dbtable" | "file" | "dynamic" | "built-in";
  columns?: SchemaColumn[];
};

export type SchemaColumn = {
  name: string;
  type: string;
  nullable?: boolean;
  label?: string;
};

export type ComponentExample = {
  title: string;
  description?: string;
  configuration: Record<string, string>;
  snippets?: string[];
};

export type ComponentUseCase = {
  id: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  typicalPattern: string;
  components: string[];
};

export type ComponentMastery = {
  componentName: string;
  whatItDoes: string;
  whenToUse: string[];
  whenNotToUse: string[];
  requiredParameters: string[];
  commonParameters: string[];
  commonErrors: Array<{
    symptom: string;
    cause: string;
    fix: string;
  }>;
  bestPractices: string[];
  examplePipelines: Array<{
    title: string;
    flow: string[];
    explanation: string;
  }>;
};
