/**
 * Snapshot de los paneles de Talend Studio (pestañas Basic y Advanced de cada componente)
 * con las etiquetas visibles, el orden de filas y el grupo. Lo consume la web para
 * replicar el panel de Studio. El formato es un contrato: no cambiar sin avisar a la web.
 */
import type {
  ComponentDefinition,
  DefinitionOption,
  DefinitionParameter,
} from "../domain/component-definition.types";

export const COMPONENT_PANELS_VERSION = 1;

/** Nombre de componente tal como aparece en los JSON del portal: t + mayuscula + resto. */
const COMPONENT_NAME = /^t[A-Z]\w+$/;

/** Componentes que el snapshot incluye siempre, aunque no aparezcan en los JSON de alcance. */
export const SIEMPRE_INCLUIDOS: readonly string[] = [
  "tFileInputDelimited", "tFileOutputDelimited", "tFileInputExcel", "tMap", "tFilterRow", "tSortRow",
  "tAggregateRow", "tUniqRow", "tJoin", "tUnite", "tReplicate", "tRunJob", "tContextLoad", "tDBInput",
  "tDBOutput", "tDBConnection", "tDBClose", "tDBRow", "tImpalaInput", "tImpalaOutput", "tImpalaRow",
  "tImpalaConnection", "tLogRow", "tLogCatcher", "tStatCatcher", "tWarn", "tDie", "tPrejob", "tPostjob",
  "tJava", "tJavaRow", "tSystem", "tFileFetch", "tFileCopy", "tFileDelete", "tFileExist",
  "tFlowToIterate", "tIterateToFlow", "tParallelize", "tSetGlobalVar", "tFilterColumns", "tConvertType",
  "tNormalize", "tDenormalize", "tSampleRow", "tSchemaComplianceCheck", "tReplace",
  "tExtractDelimitedFields", "tFileList", "tS3Put", "tS3Get", "tS3Connection",
];

export type PanelOption = { name: string; label: string | null; value: string };

export type PanelColumn = {
  name: string;
  label: string | null;
  defaultValue: string | null;
  options: PanelOption[] | null;
};

export type PanelParameter = {
  name: string;
  label: string | null;
  field: string;
  required: boolean;
  show: boolean;
  showIf: string | null;
  notShowIf: string | null;
  defaultValue: string | null;
  numRow: number | null;
  group: string | null;
  repositoryValue: string | null;
  options: PanelOption[] | null;
  table: { columns: PanelColumn[] } | null;
};

export type ComponentPanelsSnapshot = {
  version: number;
  generatedFrom: string;
  components: Record<
    string,
    {
      label: string | null;
      family: string;
      tabs: { basic: PanelParameter[]; advanced: PanelParameter[] };
    }
  >;
};

/** Recoge los nombres de componente (`^t[A-Z]\w+$`) que aparecen como valores o claves en un JSON ya parseado. */
export function collectComponentNames(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    if (COMPONENT_NAME.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectComponentNames(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (COMPONENT_NAME.test(key)) found.add(key);
      collectComponentNames(item, found);
    }
  }
  return found;
}

const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

function panelOptions(options: DefinitionOption[] | undefined): PanelOption[] | null {
  if (!options || options.length === 0) return null;
  return options.map((option) => ({
    name: option.name,
    label: orNull(option.label),
    value: option.value,
  }));
}

/**
 * Parámetro en formato del snapshot, o null si es decorativo sin etiqueta
 * (un LABEL o EMPTY que Studio pinta como texto fijo y que no tiene nombre).
 */
export function panelParameter(parameter: DefinitionParameter): PanelParameter | null {
  if (parameter.label === undefined && (parameter.field === "LABEL" || parameter.field === "EMPTY")) {
    return null;
  }
  return {
    name: parameter.name,
    label: orNull(parameter.label),
    field: parameter.field,
    required: parameter.required,
    show: parameter.show,
    showIf: orNull(parameter.showIf),
    notShowIf: orNull(parameter.notShowIf),
    defaultValue: orNull(parameter.defaultValue),
    numRow: orNull(parameter.numRow),
    group: orNull(parameter.group),
    repositoryValue: orNull(parameter.repositoryValue),
    options: panelOptions(parameter.options),
    table: parameter.table
      ? {
          columns: parameter.table.columns.map((column) => ({
            name: column.name,
            label: orNull(column.label),
            defaultValue: orNull(column.defaultValue),
            options: panelOptions(column.options),
          })),
        }
      : null,
  };
}

/** Ordena por `numRow` de menor a mayor; los que no tienen fila van al final, en su orden original. */
export function ordenarPorFila(parameters: PanelParameter[]): PanelParameter[] {
  return parameters
    .map((parameter, index) => ({ parameter, index }))
    .sort((a, b) => {
      const rowA = a.parameter.numRow;
      const rowB = b.parameter.numRow;
      if (rowA !== null && rowB !== null && rowA !== rowB) return rowA - rowB;
      if (rowA !== null && rowB === null) return -1;
      if (rowA === null && rowB !== null) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.parameter);
}

/** Pestañas de un componente: los parámetros de `<PARAMETERS>` (basic) y `<ADVANCED_PARAMETERS>` (advanced). */
export function panelTabs(definition: ComponentDefinition): {
  basic: PanelParameter[];
  advanced: PanelParameter[];
} {
  const convertir = (parameters: DefinitionParameter[]) =>
    ordenarPorFila(
      parameters
        .map(panelParameter)
        .filter((parameter): parameter is PanelParameter => parameter !== null),
    );
  return {
    basic: convertir(definition.parameters.filter((parameter) => !parameter.advanced)),
    advanced: convertir(definition.parameters.filter((parameter) => parameter.advanced)),
  };
}

/**
 * Arma el snapshot para los nombres pedidos. `find` devuelve la definicion de un
 * componente o null; los nombres sin definicion van a `missing`.
 */
export function buildComponentPanelsSnapshot(input: {
  studioVersion: string;
  names: readonly string[];
  find: (name: string) => ComponentDefinition | null;
}): { snapshot: ComponentPanelsSnapshot; missing: string[] } {
  const components: ComponentPanelsSnapshot["components"] = {};
  const missing: string[] = [];

  for (const name of [...new Set(input.names)].sort()) {
    const definition = input.find(name);
    if (!definition) {
      missing.push(name);
      continue;
    }
    components[name] = {
      label: orNull(definition.label),
      family: definition.family,
      tabs: panelTabs(definition),
    };
  }

  return {
    snapshot: {
      version: COMPONENT_PANELS_VERSION,
      generatedFrom: `Talend Studio ${input.studioVersion}`,
      components,
    },
    missing,
  };
}
