import type { ColumnSpec } from "./columns";

/**
 * Valor de un parametro de componente.
 *
 * Un string simple se escribe como `field="TEXT"`. Para los parametros que
 * Talend tipa de otra forma (FILE, CHECK, RADIO, DIRECTORY, COMPONENT_LIST)
 * se puede indicar el campo explicitamente.
 */
export type ParameterValue = string | { value: string; field?: string };

export interface ComponentSpec {
  uniqueName: string;
  componentName: string;
  /** Version del componente en Talend (por ejemplo 0.102). Sin ella Studio no resuelve el componente. */
  componentVersion?: string;
  posX?: number;
  posY?: number;
  label?: string;
  parameters?: Record<string, ParameterValue>;
  schema?: {
    name: string;
    connector?: string;
    columns: ColumnSpec[];
  };
}

export interface ConnectionSpec {
  source: string;
  target: string;
  label: string;
  connectorName?: string;
  metaname?: string;
  uniqueName?: string;
}

export interface ContextParamSpec {
  name: string;
  type: string;
  value: string;
  comment?: string;
}

export interface JobSpec {
  jobName: string;
  version?: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
  components: ComponentSpec[];
  connections?: ConnectionSpec[];
  contexts?: ContextParamSpec[];
}

export interface JobletSpec {
  jobletName: string;
  version?: string;
  defaultContext?: string;
  label?: string;
  description?: string;
  purpose?: string;
  folderPath?: string;
  components: ComponentSpec[];
  connections?: ConnectionSpec[];
  contexts?: ContextParamSpec[];
}
