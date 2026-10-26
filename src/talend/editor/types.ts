/**
 * Tipos del editor XML de Talend.
 *
 * Viven aparte para que las operaciones de componentes, contextos y
 * propiedades compartan la misma forma sin depender entre si.
 */

export type XmlRecord = Record<string, unknown>;

export type EditResult = {
  xml: string;
  changed: boolean;
  diff: string;
};

export type ParameterEditOptions = {
  uniqueName: string;
  parameterName: string;
  value: string;
};

export type SchemaColumnEditOptions = {
  uniqueName: string;
  schemaName: string;
  columnName: string;
  patch: {
    name?: string;
    type?: string;
    length?: number;
    precision?: number;
    nullable?: boolean;
    key?: boolean;
    sourceType?: string;
    pattern?: string;
  };
};

export type DuplicateComponentOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
};

export type AddConnectionOptions = {
  sourceUniqueName: string;
  targetUniqueName: string;
  label: string;
  connectorName: string;
  metaname: string;
  uniqueName: string;
};

export type ContextEditOptions = {
  contextName: string;
  parameterName: string;
  value: string;
  type?: string;
  prompt?: string;
};

export type JobPropertiesEditOptions = {
  label?: string;
  description?: string;
  purpose?: string;
};

export type DeleteComponentOptions = {
  uniqueName: string;
};

export type DeleteConnectionOptions = {
  uniqueName: string;
};

export type MoveComponentOptions = {
  uniqueName: string;
  posX: number;
  posY: number;
};
