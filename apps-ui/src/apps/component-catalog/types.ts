export interface ComponentInfo {
  family: string;
  name: string;
  version?: string;
  description?: string;
}

export interface ComponentSearchResult {
  components: ComponentInfo[];
  total: number;
}

export interface ComponentDetails {
  family: string;
  name: string;
  version?: string;
  description?: string;
  parameters?: ComponentParameter[];
  connectors?: ComponentConnector[];
}

export interface ComponentParameter {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  values?: string[];
}

export interface ComponentConnector {
  name: string;
  type: "INPUT" | "OUTPUT" | "FLOW";
  description?: string;
}

export interface TemplateResult {
  ok: boolean;
  template?: string;
  error?: string;
}
