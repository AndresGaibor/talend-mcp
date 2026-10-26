export type ComponentCatalogEntry = {
  componentName: string;
  family: string;
  version: string;
  pluginJar: string;
  definitionFiles: string[];
  parameters: ComponentParameter[];
  schemas: {
    hasInputSchema: boolean;
    hasOutputSchema: boolean;
    hasDynamicSchema: boolean;
  };
  connectors: string[];
  dependencies: string[];
  limitations: string[];
};

export type ComponentParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string;
  show: boolean;
  repositoryValue: string | null;
  description?: string;
};

export type CatalogStatus = {
  ok: boolean;
  catalogPath: string | null;
  entryCount: number;
  lastUpdated: number | null;
  scannedPlugins: string[];
  errors: string[];
};
