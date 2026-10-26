export type ComponentJarEntry = {
  componentName: string;
  family: string;
  version: string;
  sourcePlugin: string;
  definitionFiles: string[];
  parameters: JarParameter[];
  connectors: JarConnector[];
  schemas: JarSchemas;
  capabilities: JarCapabilities;
  limitations: string[];
};

export type JarParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string | null;
  show: boolean;
  repositoryValue: string | null;
  raw?: Record<string, unknown>;
};

export type JarConnector = {
  name: string;
  type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP" | "UNKNOWN";
  maxInput?: number;
  maxOutput?: number;
};

export type JarSchemas = {
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasDynamicSchema: boolean;
};

export type JarCapabilities = {
  canStartFlow: boolean;
  canReceiveFlow: boolean;
  canOutputFlow: boolean;
  canUseReject: boolean;
  canUseIterate: boolean;
};

export type ScanPluginsResult = {
  scannedPlugins: string[];
  entries: ComponentJarEntry[];
  errors: string[];
};
