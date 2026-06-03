import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ERRORS_DIR = ".talend-mcp";
const ERRORS_FILE = "error-knowledge-base.json";

export type KnownError = {
  id: string;
  patterns: string[];
  category: string;
  component?: string;
  cause: string;
  suggestedFix: string;
  canAutoFix: boolean;
  confidence: "high" | "medium" | "low";
  occurrences: number;
  lastSeen: number;
};

export type ErrorKnowledgeBase = {
  version: number;
  generatedAt: number;
  errors: KnownError[];
};

function ensureErrorsDir(): string {
  const dir = join(process.cwd(), ERRORS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const INITIAL_ERRORS: KnownError[] = [
  {
    id: "context_param_not_found",
    patterns: ["Context parameter not found", "No se encontró el parámetro de contexto", "Context variable.*not found"],
    category: "context",
    cause: "Falta definir el parámetro en el contexto del job",
    suggestedFix: "Crear el parámetro en el archivo .properties o en la pestaña Context del job en Studio",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "file_not_found",
    patterns: ["File not found", "El archivo no existe", "No se puede encontrar el archivo"],
    category: "io",
    cause: "Ruta de archivo incorrecta o archivo eliminado",
    suggestedFix: "Verificar que la ruta del archivo exista y los permisos sean correctos",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "no_suitable_driver",
    patterns: ["No suitable driver", "No se encontró el driver", "ClassNotFoundException.*driver"],
    category: "database",
    cause: "Driver JDBC no disponible o no cargado correctamente",
    suggestedFix: "Agregar el JAR del driver JDBC a la carpeta lib del job o al repositorio",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "connection_refused",
    patterns: ["Connection refused", "Conexión rehusada", "Unable to connect"],
    category: "network",
    cause: "El servicio no está disponible o el puerto es incorrecto",
    suggestedFix: "Verificar que el servicio esté corriendo y la dirección:puerto sean correctos",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "column_not_found",
    patterns: ["Column.*not found", "Columna.*no encontrada", "Unknown column"],
    category: "database",
    cause: "El nombre de columna no existe en el schema o está mal escrito",
    suggestedFix: "Verificar el schema de la tabla y corregir el nombre de la columna",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "cannot_convert_string_to_integer",
    patterns: ["Cannot convert from String to Integer", "No se puede convertir de String a Integer", "type mismatch"],
    category: "type",
    cause: "Se intenta convertir un String a Integer pero el formato no es numérico",
    suggestedFix: "Verificar que el valor sea numérico o usar tMap para transformar",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "null_pointer",
    patterns: ["NullPointerException", "java.lang.NullPointerException"],
    category: "runtime",
    cause: "Se intenta usar un objeto que es null",
    suggestedFix: "Agregar validación de null antes de usar el objeto o usar tMap con expresión Ternary",
    canAutoFix: false,
    confidence: "medium",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "schema_mismatch",
    patterns: ["Schema mismatch", "El esquema no coincide", "schema incompatible"],
    category: "schema",
    cause: "El schema de entrada no coincide con el de salida en un componente",
    suggestedFix: "Revisar los esquemas en las pestañas Schema de los componentes involucrados",
    canAutoFix: false,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "duplicate_unique_name",
    patterns: ["Duplicate uniqueName", "UNIQUE_NAME ya existe", "uniqueName.*duplicate"],
    category: "design",
    cause: "Dos componentes tienen el mismo UNIQUE_NAME en el job",
    suggestedFix: "Renombrar uno de los componentes para que tenga un UNIQUE_NAME único",
    canAutoFix: true,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
  {
    id: "dangling_connection",
    patterns: ["Dangling connection", "Conexión colgante", "connection without source or target"],
    category: "design",
    cause: "Existe una conexión sin origen o sin destino",
    suggestedFix: "Eliminar la conexión incompleta o conectar correctamente los componentes",
    canAutoFix: true,
    confidence: "high",
    occurrences: 0,
    lastSeen: 0,
  },
];

function loadKnowledgeBase(): ErrorKnowledgeBase {
  const path = join(ensureErrorsDir(), ERRORS_FILE);
  if (!existsSync(path)) {
    return { version: 1, generatedAt: Date.now(), errors: [...INITIAL_ERRORS] };
  }
  try {
    const content = readFileSync(path, "utf8");
    return JSON.parse(content) as ErrorKnowledgeBase;
  } catch {
    return { version: 1, generatedAt: Date.now(), errors: [...INITIAL_ERRORS] };
  }
}

function saveKnowledgeBase(kb: ErrorKnowledgeBase): void {
  const path = join(ensureErrorsDir(), ERRORS_FILE);
  writeFileSync(path, JSON.stringify(kb, null, 2), "utf8");
}

export function getKnowledgeBase(): ErrorKnowledgeBase {
  return loadKnowledgeBase();
}

export function analyzeError(errorMessage: string): KnownError | null {
  const kb = loadKnowledgeBase();
  const lower = errorMessage.toLowerCase();
  for (const err of kb.errors) {
    for (const pattern of err.patterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(errorMessage) || lower.includes(pattern.toLowerCase())) {
        err.occurrences++;
        err.lastSeen = Date.now();
        saveKnowledgeBase(kb);
        return err;
      }
    }
  }
  return null;
}

export function getLatestErrors(limit = 20): KnownError[] {
  const kb = loadKnowledgeBase();
  return kb.errors
    .filter((e) => e.lastSeen > 0)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, limit);
}

export function getErrorById(id: string): KnownError | null {
  const kb = loadKnowledgeBase();
  return kb.errors.find((e) => e.id === id) ?? null;
}

export function getErrorsByCategory(category: string): KnownError[] {
  const kb = loadKnowledgeBase();
  return kb.errors.filter((e) => e.category === category);
}

export function addCustomError(
  pattern: string,
  category: string,
  cause: string,
  suggestedFix: string,
  canAutoFix = false
): KnownError {
  const kb = loadKnowledgeBase();
  const id = "custom_" + Date.now();
  const err: KnownError = {
    id,
    patterns: [pattern],
    category,
    cause,
    suggestedFix,
    canAutoFix,
    confidence: "medium",
    occurrences: 0,
    lastSeen: 0,
  };
  kb.errors.push(err);
  saveKnowledgeBase(kb);
  return err;
}

export function suggestFix(errorMessage: string): { error: KnownError | null; advice: string } {
  const err = analyzeError(errorMessage);
  if (!err) {
    return {
      error: null,
      advice: "Error desconocido. Revisa el mensaje completo y busca en los logs de Talend Studio.",
    };
  }
  let advice = `Categoría: ${err.category}\nCausa: ${err.cause}\nSolución sugerida: ${err.suggestedFix}`;
  if (err.canAutoFix) {
    advice += "\n⚡ Este error puede auto-corregirse.";
  }
  return { error: err, advice };
}

export function getErrorStats(): { total: number; byCategory: Record<string, number>; autoFixable: number } {
  const kb = loadKnowledgeBase();
  const byCategory: Record<string, number> = {};
  for (const err of kb.errors) {
    byCategory[err.category] = (byCategory[err.category] ?? 0) + err.occurrences;
  }
  return {
    total: kb.errors.reduce((sum, e) => sum + e.occurrences, 0),
    byCategory,
    autoFixable: kb.errors.filter((e) => e.canAutoFix).length,
  };
}