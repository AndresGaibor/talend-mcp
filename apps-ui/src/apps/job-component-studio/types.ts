export interface ActiveJobComponentSummary {
  uniqueName: string;
  componentName: string;
  label: string;
  name: string;
  class?: string;
  posX?: number;
  posY?: number;
}

export interface ActiveJobConnection {
  name: string;
  type: string;
  connectorName: string;
  source: string;
  target: string;
}

export interface ActiveJobDetails {
  ok: boolean;
  job?: {
    getLabel?: string;
    getName?: string;
    getVersion?: string;
    available?: boolean;
    class?: string;
  };
  activeEditor?: {
    title: string;
    class: string;
    dirty: boolean;
  };
  components?: ActiveJobComponentSummary[];
  connections?: ActiveJobConnection[];
  warning?: string;
}

export interface ComponentParameter {
  name: string;
  value: string;
  field?: string;
  show?: boolean;
}

export interface SchemaColumn {
  name: string;
  type?: string;
  length?: number;
  precision?: number;
  nullable?: boolean;
  key?: boolean;
}

export interface ComponentSchema {
  name?: string;
  connector?: string;
  label?: string;
  columns: SchemaColumn[];
}

export interface ActiveComponentDetails {
  job: {
    name: string;
    version: string;
    editorTitle?: string;
  };
  component: {
    uniqueName: string;
    label: string;
    componentName: string;
    className: string;
    posX?: number;
    posY?: number;
    parameters: ComponentParameter[];
    schemas: ComponentSchema[];
    incomingConnections: ActiveJobConnection[];
    outgoingConnections: ActiveJobConnection[];
    raw?: any;
  };
}
