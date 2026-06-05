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
    requiredParameters: ["FILENAME", "ROWSEPARATOR", "FIELDSEPARATOR"],
    defaultParameters: {
      ROWSEPARATOR: '"\\n"',
      FIELDSEPARATOR: '";"',
      HEADER: "0",
      FOOTER: "0",
      LIMIT: "",
      REMOVE_EMPTY_ROW: "true",
      UNCOMPRESS: "false",
      DIE_ON_ERROR: "false",
      TRIMALL: "false",
      ENCODING: '"ISO-8859-15"',
      CSV_OPTION: "false"
    }
  },
  tMap: {
    name: "tMap",
    category: "Processing",
    description: "Transformaciones y mapeos de datos complejos.",
    requiredParameters: [],
    defaultParameters: {
      LINK_STYLE: "AUTO",
      CHANGE_HASH_AND_EQUALS_FOR_BIGDECIMAL: "true"
    },
    hasNodeData: true
  },
  tMysqlOutput: {
    name: "tMysqlOutput",
    category: "Databases/MySQL",
    description: "Escribe datos en una tabla MySQL.",
    requiredParameters: ["HOST", "PORT", "DBNAME", "USER", "PASS", "TABLE"],
    defaultParameters: {
      DB_VERSION: "MYSQL_8",
      USE_EXISTING_CONNECTION: "false",
      TABLE_ACTION: "NONE",
      DATA_ACTION: "INSERT",
      DIE_ON_ERROR: "false",
      USE_BATCH_SIZE: "true",
      BATCH_SIZE: "10000",
      COMMIT_EVERY: "10000"
    }
  },
  tMysqlConnection: {
    name: "tMysqlConnection",
    category: "Databases/MySQL",
    description: "Crea una conexión compartida a MySQL.",
    requiredParameters: ["HOST", "PORT", "DBNAME", "USER", "PASS"],
    defaultParameters: {
      DB_VERSION: "MYSQL_8",
      PROPERTIES: '"noDatetimeStringSync=true"',
      AUTO_COMMIT: "false"
    }
  },
  tMysqlClose: {
    name: "tMysqlClose",
    category: "Databases/MySQL",
    description: "Cierra una conexión a MySQL.",
    requiredParameters: ["CONNECTION"],
    defaultParameters: {
      CONNECTION: ""
    }
  },
  tMysqlInput: {
    name: "tMysqlInput",
    category: "Databases/MySQL",
    description: "Lee datos de una tabla o consulta MySQL.",
    requiredParameters: ["QUERY"],
    defaultParameters: {
      DB_VERSION: "MYSQL_8",
      USE_EXISTING_CONNECTION: "false",
      QUERY: '"select id, name from employee"',
      TRIM_ALL_COLUMN: "false"
    }
  },
  tMysqlRow: {
    name: "tMysqlRow",
    category: "Databases/MySQL",
    description: "Ejecuta sentencias SQL y Stored Procedures en MySQL.",
    requiredParameters: ["QUERY"],
    defaultParameters: {
      USE_EXISTING_CONNECTION: "false",
      DIE_ON_ERROR: "false",
      PROPAGATE_RECORD_SET: "false",
      USE_PREPAREDSTATEMENT: "false",
      COMMIT_EVERY: "10000"
    }
  },
  tRunJob: {
    name: "tRunJob",
    category: "System/Orchestration",
    description: "Invoca la ejecución de un job hijo.",
    requiredParameters: ["PROCESS"],
    defaultParameters: {
      USE_DYNAMIC_JOB: "false",
      DIE_ON_CHILD_ERROR: "true",
      TRANSMIT_WHOLE_CONTEXT: "false",
      USE_BASE64: "true"
    }
  },
  tLoop: {
    name: "tLoop",
    category: "Orchestration",
    description: "Genera bucles iterativos de tipo FOR o WHILE.",
    requiredParameters: [],
    defaultParameters: {
      FORLOOP: "true",
      WHILELOOP: "false",
      FROM: "1",
      TO: "10",
      STEP: "1",
      INCREASE: "true"
    }
  },
  tSetGlobalVar: {
    name: "tSetGlobalVar",
    category: "Custom_Code",
    description: "Define variables clave-valor en el mapa global.",
    requiredParameters: [],
    defaultParameters: {}
  },
  tLogCatcher: {
    name: "tLogCatcher",
    category: "Logs_Errors",
    description: "Captura excepciones de Java y fallos de tDie/tWarn.",
    requiredParameters: [],
    defaultParameters: {
      CATCH_JAVA_EXCEPTION: "true",
      CATCH_TDIE: "true",
      CATCH_TWARN: "true"
    }
  },
  tStatCatcher: {
    name: "tStatCatcher",
    category: "Logs_Errors",
    description: "Captura estadísticas detalladas de rendimiento del job.",
    requiredParameters: [],
    defaultParameters: {}
  },
  tFlowToIterate: {
    name: "tFlowToIterate",
    category: "Orchestration",
    description: "Convierte un flujo en una señal de iteración por registro.",
    requiredParameters: [],
    defaultParameters: {
      DEFAULT_MAP: "true"
    }
  },
  tFixedFlowInput: {
    name: "tFixedFlowInput",
    category: "Misc",
    description: "Genera un flujo a partir de datos fijos inline.",
    requiredParameters: ["NB_ROWS"],
    defaultParameters: {
      NB_ROWS: "1",
      USE_SINGLEMODE: "true"
    }
  },
  tFilterRow: {
    name: "tFilterRow",
    category: "Processing",
    description: "Filtra registros del flujo según condiciones lógicas o código Java.",
    requiredParameters: [],
    defaultParameters: {
      LOGICAL_OP: '"&&"',
      USE_ADVANCED: "false"
    }
  },
  tLogRow: {
    name: "tLogRow",
    category: "Logs_Errors",
    description: "Muestra el flujo de datos en la consola del Studio.",
    requiredParameters: [],
    defaultParameters: {
      BASIC_MODE: "true",
      TABLE_PRINT: "false",
      VERTICAL: "false",
      FIELDSEPARATOR: '"|"',
      PRINT_HEADER: "false",
      PRINT_UNIQUE_NAME: "false",
      PRINT_COLNAMES: "false",
      USE_FIXED_LENGTH: "false",
      PRINT_CONTENT_WITH_LOG4J: "true"
    }
  },
  tSendMail: {
    name: "tSendMail",
    category: "Internet",
    description: "Envía un correo electrónico SMTP.",
    requiredParameters: ["TO", "FROM", "SUBJECT", "MESSAGE", "SMTP_HOST", "SMTP_PORT"],
    defaultParameters: {
      SMTP_PORT: "25",
      SSL: "false",
      STARTTLS: "false",
      IMPORTANCE: "NORMAL",
      AUTH_MODE: "BASIC",
      DIE_ON_ERROR: "true",
      TEXT_SUBTYPE: "PLAIN",
      ENCODING: '"ISO-8859-15"'
    }
  },
  tPrejob: {
    name: "tPrejob",
    category: "Orchestration",
    description: "Hook de inicio antes del procesamiento principal.",
    requiredParameters: [],
    defaultParameters: {}
  },
  tPostjob: {
    name: "tPostjob",
    category: "Orchestration",
    description: "Hook de cierre tras el procesamiento del job.",
    requiredParameters: [],
    defaultParameters: {}
  },
  tJava: {
    name: "tJava",
    category: "Custom_Code",
    description: "Bloque de código Java libre ejecutado en lote.",
    requiredParameters: ["CODE"],
    defaultParameters: {
      CODE: 'System.out.println("hello");'
    }
  },
  tJavaRow: {
    name: "tJavaRow",
    category: "Custom_Code",
    description: "Bloque de código Java ejecutado fila a fila sobre el flujo.",
    requiredParameters: ["CODE"],
    defaultParameters: {
      CODE: '// output_row.id = input_row.id;'
    }
  },
  tRESTClient: {
    name: "tRESTClient",
    category: "ESB/REST",
    description: "Consume un servicio Web de tipo REST HTTP.",
    requiredParameters: ["URL", "METHOD"],
    defaultParameters: {
      URL: '"http://localhost:8080"',
      METHOD: "GET",
      CONTENT_TYPE: "application/xml",
      ACCEPT_TYPE: "application/xml",
      DIE_ON_ERROR: "false",
      LOG_MESSAGES: "false",
      NEED_AUTH: "false",
      DROP_JSON_REQUEST_ROOT: "false",
      WRAP_JSON_RESPONSE: "true"
    }
  }
};

export function getComponentSnippet(name: string): any {
  const def = COMPONENT_REGISTRY[name];
  if (!def) return null;

  return {
    uniqueName: `${name}_1`,
    componentName: name,
    parameters: def.defaultParameters,
    posX: 128,
    posY: 128
  };
}
