export interface ComponentDefinition {
  name: string;
  category: string;
  description: string;
  requiredParameters: string[];
  defaultParameters: Record<string, string>;
  hasNodeData?: boolean; // Para componentes complejos como tMap
}

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  tFileInputDelimited: {
    name: "tFileInputDelimited",
    category: "File/Input",
    description: "Lee archivos delimitados (CSV, etc.).",
    requiredParameters: ["FILENAME", "ROWSEPARATOR", "FIELDSEPARATOR", "HEADER"],
    defaultParameters: {
      ROWSEPARATOR: '"\\n"',
      FIELDSEPARATOR: '";"',
      HEADER: "1",
      ENCODING: '"ISO-8859-15"',
    },
  },
  tFixedFlowInput: {
    name: "tFixedFlowInput",
    category: "Misc",
    description: "Genera un flujo de datos basado en valores fijos.",
    requiredParameters: ["NB_ROWS"],
    defaultParameters: {
      NB_ROWS: "1",
      USE_SINGLEMODE: "true",
    },
  },
  tLogRow: {
    name: "tLogRow",
    category: "Logs_Errors",
    description: "Muestra el flujo de datos en la consola del Studio.",
    requiredParameters: [],
    defaultParameters: {
      BASIC_MODE: "true",
      TABLE_PRINT: "false",
      FIELDSEPARATOR: '"|"',
    },
  },
  tMysqlOutput: {
    name: "tMysqlOutput",
    category: "Databases/MySQL",
    description: "Escribe datos en una tabla MySQL.",
    requiredParameters: ["HOST", "PORT", "DBNAME", "USER", "PASS", "TABLE"],
    defaultParameters: {
      DB_VERSION: "MYSQL_8",
      TABLE_ACTION: "NONE",
      DATA_ACTION: "INSERT",
      USE_BATCH_SIZE: "true",
      BATCH_SIZE: "10000",
    },
  },
  tMap: {
    name: "tMap",
    category: "Processing",
    description: "Transformaciones y mapeos de datos complejos.",
    requiredParameters: [],
    defaultParameters: {
      LINK_STYLE: "AUTO",
      CHANGE_HASH_AND_EQUALS_FOR_BIGDECIMAL: "true",
    },
    hasNodeData: true,
  },
  tFlowToIterate: {
    name: "tFlowToIterate",
    category: "Orchestration",
    description: "Convierte un flujo en una iteración (row to global variable).",
    requiredParameters: [],
    defaultParameters: {
      DEFAULT_MAP: "true",
    },
  },
  tStatCatcher: {
    name: "tStatCatcher",
    category: "Logs_Errors",
    description: "Captura métricas de ejecución del job.",
    requiredParameters: [],
    defaultParameters: {},
  },
};

export function getComponentSnippet(name: string): any {
  const def = COMPONENT_REGISTRY[name];
  if (!def) return null;

  return {
    uniqueName: `${name}_1`,
    componentName: name,
    parameters: def.defaultParameters,
    posX: 128,
    posY: 128,
  };
}
