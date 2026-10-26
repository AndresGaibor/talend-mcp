import type { Recipe } from "./types";
import { containsAny } from "./pattern-matcher";

/** Genera una receta por inferencia cuando ningún patrón conocido aplica. */
export function generateFallbackRecipe(objective: string, normalizedObjective: string): Recipe {
  const components = inferComponentsFromObjective(normalizedObjective);
  const flow = generateFlowFromComponents(components);

  return {
    id: crypto.randomUUID(),
    objective: objective,
    components,
    flow,
    explanation: generateExplanation(objective, components),
    confidence: 0.6,
  };
}

/** Deduce componentes candidatos a partir de las palabras del objetivo. */
function inferComponentsFromObjective(objective: string): string[] {
  const components: string[] = [];

  if (containsAny(objective, ["csv", "archivo", "file", "delimited"])) {
    components.push("tFileInputDelimited");
  }

  if (containsAny(objective, ["excel", "xls", "xlsx"])) {
    components.push("tFileInputExcel");
  }

  if (containsAny(objective, ["xml"])) {
    components.push("tFileInputXML");
  }

  if (containsAny(objective, ["api", "rest", "http", "web service"])) {
    components.push("tHTTPRequest");
    if (containsAny(objective, ["json"])) {
      components.push("tJSONParser");
    }
  }

  if (containsAny(objective, ["base de datos", "mysql", "postgres", "singlestore", "oracle", "sql"])) {
    components.push("tDBInput");
  }

  if (components.length === 0) {
    components.push("tFileInputDelimited");
  }

  if (containsAny(objective, ["transformar", "mapear", "transform", "map"])) {
    if (!components.includes("tMap")) {
      components.push("tMap");
    }
  }

  if (containsAny(objective, ["filtrar", "filter", "nulos", "null", "limpiar"])) {
    if (!components.includes("tFilterRow")) {
      components.push("tFilterRow");
    }
  }

  if (containsAny(objective, ["agregar", "suma", "promedio", "count", "group"])) {
    if (!components.includes("tAggregateRow")) {
      components.push("tAggregateRow");
    }
  }

  if (containsAny(objective, ["único", "duplicados", "unique", "dedupe"])) {
    if (!components.includes("tUniqRow")) {
      components.push("tUniqRow");
    }
  }

  if (containsAny(objective, ["guardar", "cargar", "base de datos", "mysql", "postgres", "singlestore", "oracle", "sql", "output", "save"])) {
    if (!components.includes("tDBOutput") && !components.includes("tFileOutputDelimited")) {
      if (containsAny(objective, ["base de datos", "mysql", "postgres", "singlestore", "oracle", "sql"])) {
        components.push("tDBOutput");
      } else {
        components.push("tFileOutputDelimited");
      }
    }
  }

  if (containsAny(objective, ["archivo", "csv", "exportar", "output", "file"])) {
    if (!components.includes("tDBOutput") && !components.includes("tFileOutputDelimited")) {
      components.push("tFileOutputDelimited");
    }
  }

  if (containsAny(objective, ["api", "rest", "http", "enviar", "post", "put"])) {
    if (!components.includes("tHTTPRequest")) {
      components.push("tHTTPRequest");
    }
  }

  if (components.length === 0 || isGenericObjective(objective)) {
    return ["tFileInputDelimited", "tMap", "tFileOutputDelimited"];
  }

  return components;
}

/** Encadena los componentes en pasos legibles. */
function generateFlowFromComponents(components: string[]): string[] {
  const flows: string[] = [];
  for (let i = 0; i < components.length - 1; i++) {
    flows.push(`${components[i]} -> ${components[i + 1]}`);
  }
  return flows;
}

/** Explica de dónde sale la receta inferida. */
function generateExplanation(objective: string, components: string[]): string {
  const componentList = components.join(" -> ");
  return `Recipe generado para: "${objective}". Flujo recomendado: ${componentList}. Este flujo fue inferido automáticamente basándose en las palabras clave detectadas en el objetivo.`;
}

/** True si el objetivo es una petición genérica sin detalles suficientes. */
function isGenericObjective(objective: string): boolean {
  const genericPatterns = [
    "procesar",
    "transformar",
    "cargar",
    "leer",
    "guardar",
    "extraer",
    "process",
    "transform",
    "load",
    "read",
    "write",
    "save",
    "extract",
  ];
  return genericPatterns.some((p) => objective.includes(p)) && countSignificantWords(objective) <= 3;
}

/** Cuenta palabras con contenido, ignorando artículos y preposiciones. */
function countSignificantWords(objective: string): number {
  const stopWords = ["de", "del", "la", "el", "en", "a", "y", "para", "con", "por", "una", "un", "los", "las"];
  const words = objective.split(/\s+/).filter((w) => !stopWords.includes(w) && w.length > 2);
  return words.length;
}
