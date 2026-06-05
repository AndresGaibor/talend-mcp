export type Recipe = {
  id: string;
  objective: string;
  components: string[];
  flow: string[];
  explanation: string;
  confidence: number;
};

export type PipelineSpec = {
  name?: string;
  description?: string;
  components?: unknown[];
  connections?: unknown[];
  [key: string]: unknown;
};

type PatternRecipe = {
  id: string;
  objective: string;
  components: string[];
  flow: string[];
  explanation: string;
  confidence: number;
  keywords: string[];
};

const KNOWN_PATTERNS: PatternRecipe[] = [
  {
    id: "csv-to-db",
    objective: "leer CSV, limpiar nulos, cargar a SingleStore",
    components: ["tFileInputDelimited", "tMap", "tFilterRow", "tDBOutput"],
    flow: ["tFileInputDelimited -> tMap -> tFilterRow -> tDBOutput"],
    explanation: "Este patrón lee un archivo CSV, aplica un mapeo para transformar columnas, filtra filas con valores nulos, y carga el resultado a una base de datos SingleStore. El flujo tFileInputDelimited->tMap->tFilterRow->tDBOutput es el estándar para ETL básico con limpieza de datos.",
    confidence: 0.95,
    keywords: ["csv", "archivo", "SingleStore", "base de datos", "nulos", "limpiar", "cargar"],
  },
  {
    id: "csv-to-db-simple",
    objective: "leer CSV y guardar en base de datos",
    components: ["tFileInputDelimited", "tMap", "tDBOutput"],
    flow: ["tFileInputDelimited -> tMap -> tDBOutput"],
    explanation: "Patrón directo para cargar datos de CSV a base de datos. El componente tMap permite transformar las columnas según el esquema de la tabla destino.",
    confidence: 0.9,
    keywords: ["csv", "base de datos", "mysql", "postgres", "singlestore", "cargar"],
  },
  {
    id: "db-to-csv",
    objective: "leer de MySQL, transformar, guardar en archivo",
    components: ["tDBInput", "tMap", "tFileOutputDelimited"],
    flow: ["tDBInput -> tMap -> tFileOutputDelimited"],
    explanation: "Este patrón extrae datos de MySQL, los transforma mediante un mapeo, y los exporta a un archivo CSV. Es el patrón típico para ETL inverso (database-to-file).",
    confidence: 0.95,
    keywords: ["mysql", "base de datos", "csv", "archivo", "exportar", "extraer"],
  },
  {
    id: "db-to-db",
    objective: "leer de base de datos y guardar en otra base de datos",
    components: ["tDBInput", "tMap", "tDBOutput"],
    flow: ["tDBInput -> tMap -> tDBOutput"],
    explanation: "Patrón ETL completo para mover datos entre bases de datos. El componente tMap se encarga de cualquier transformación de esquema entre origen y destino.",
    confidence: 0.9,
    keywords: ["base de datos", "mysql", "postgres", "singlestore", "oracle", "copiar", "mover"],
  },
  {
    id: "file-to-file",
    objective: "leer archivo y guardar en otro archivo",
    components: ["tFileInputDelimited", "tMap", "tFileOutputDelimited"],
    flow: ["tFileInputDelimited -> tMap -> tFileOutputDelimited"],
    explanation: "Patrón para transformación de archivos sin base de datos. El tMap permite renombrar columnas, cambiar tipos, o aplicar fórmulas.",
    confidence: 0.9,
    keywords: ["archivo", "csv", "transformar", "convertir"],
  },
  {
    id: "api-to-db",
    objective: "leer de API REST y guardar en base de datos",
    components: ["tHTTPRequest", "tJSONParser", "tMap", "tDBOutput"],
    flow: ["tHTTPRequest -> tJSONParser -> tMap -> tDBOutput"],
    explanation: "Patrón para integrar datos de APIs REST. tHTTPRequest consume el endpoint, tJSONParser convierte la respuesta a filas, tMap transforma los datos, y tDBOutput los persiste.",
    confidence: 0.9,
    keywords: ["api", "rest", "http", "json", "base de datos", "cargar"],
  },
  {
    id: "db-to-api",
    objective: "leer de base de datos y enviar a API REST",
    components: ["tDBInput", "tMap", "tJSONBuilder", "tHTTPRequest"],
    flow: ["tDBInput -> tMap -> tJSONBuilder -> tHTTPRequest"],
    explanation: "Patrón para publicar datos de base de datos a una API REST. Transforma filas de BD a JSON y las envía mediante POST/PUT.",
    confidence: 0.9,
    keywords: ["base de datos", "api", "rest", "http", "json", "enviar"],
  },
  {
    id: "csv-clean-nulls",
    objective: "leer CSV y limpiar valores nulos",
    components: ["tFileInputDelimited", "tMap", "tFilterRow", "tFileOutputDelimited"],
    flow: ["tFileInputDelimited -> tMap -> tFilterRow -> tFileOutputDelimited"],
    explanation: "Patrón para limpieza de datos CSV. Lee el archivo, aplica mapeo, filtra filas con nulos, y guarda el resultado limpio.",
    confidence: 0.9,
    keywords: ["csv", "nulos", "limpiar", "filtrar", "archivo"],
  },
  {
    id: "excel-to-db",
    objective: "leer Excel y cargar a base de datos",
    components: ["tFileInputExcel", "tMap", "tDBOutput"],
    flow: ["tFileInputExcel -> tMap -> tDBOutput"],
    explanation: "Patrón para cargar datos desde archivos Excel a base de datos. Soporta tanto .xls como .xlsx.",
    confidence: 0.85,
    keywords: ["excel", "xls", "xlsx", "base de datos", "cargar"],
  },
  {
    id: "db-to-excel",
    objective: "leer de base de datos y guardar en Excel",
    components: ["tDBInput", "tMap", "tFileOutputExcel"],
    flow: ["tDBInput -> tMap -> tFileOutputExcel"],
    explanation: "Patrón para exportar datos de base de datos a archivos Excel. Genera archivos .xlsx con los datos transformados.",
    confidence: 0.85,
    keywords: ["base de datos", "excel", "xls", "xlsx", "exportar"],
  },
  {
    id: "multi-file-merge",
    objective: "leer múltiples archivos CSV y combinar",
    components: ["tFileInputDelimited", "tFileList", "tMap", "tUnite", "tFileOutputDelimited"],
    flow: ["tFileList -> iterate -> tFileInputDelimited -> tMap -> tUnite -> tFileOutputDelimited"],
    explanation: "Patrón para consolidar múltiples archivos CSV en uno solo. Usa tFileList para iterar, tUnite para combinar flujos.",
    confidence: 0.85,
    keywords: ["csv", "múltiples", "combinar", "unir", "merge", "archivos"],
  },
  {
    id: "xml-processing",
    objective: "leer XML y transformar",
    components: ["tFileInputXML", "tXMLMap", "tFileOutputDelimited"],
    flow: ["tFileInputXML -> tXMLMap -> tFileOutputDelimited"],
    explanation: "Patrón para procesar archivos XML. tXMLMap permite extraer y transformar datos de estructuras XML complejas.",
    confidence: 0.85,
    keywords: ["xml", "transformar", "archivo"],
  },
  {
    id: "denormalize",
    objective: "denormalizar datos joining tablas",
    components: ["tDBInput", "tDBInput", "tMap", "tDBOutput"],
    flow: ["tDBInput(Main) -> tMap -> tDBOutput", "tDBInput(Lookup) -> tMap"],
    explanation: "Patrón para denormalización mediante joins. Usa un flujo principal y un flujo lookup en tMap para enriquecer datos.",
    confidence: 0.85,
    keywords: ["join", "denormalizar", "tablas", "base de datos", "lookup"],
  },
  {
    id: "aggregation",
    objective: "agregar datos de base de datos",
    components: ["tDBInput", "tAggregateRow", "tMap", "tFileOutputDelimited"],
    flow: ["tDBInput -> tAggregateRow -> tMap -> tFileOutputDelimited"],
    explanation: "Patrón para agregación de datos. tAggregateRow agrupa y calcula sumas, promedios, conteos, etc.",
    confidence: 0.85,
    keywords: ["agregar", "suma", "promedio", "count", "group by", "base de datos"],
  },
  {
    id: "deduplicate",
    objective: "eliminar duplicados de datos",
    components: ["tDBInput", "tUniqRow", "tDBOutput"],
    flow: ["tDBInput -> tUniqRow -> tDBOutput"],
    explanation: "Patrón para deduplicación. tUniqRow elimina filas duplicadas basándose en columnas clave.",
    confidence: 0.9,
    keywords: ["duplicados", "único", "dedupe", "base de datos"],
  },
];

export class RecipeGeneratorUseCase {
  private recipes: Map<string, Recipe> = new Map();

  generateRecipe(objective: string): Recipe {
    const normalizedObjective = objective.toLowerCase().trim();
    const matchedPattern = this.findBestMatch(normalizedObjective);

    if (matchedPattern) {
      const recipe: Recipe = {
        id: crypto.randomUUID(),
        objective: objective,
        components: [...matchedPattern.components],
        flow: [...matchedPattern.flow],
        explanation: matchedPattern.explanation,
        confidence: matchedPattern.confidence,
      };
      this.recipes.set(recipe.id, recipe);
      return recipe;
    }

    const fallbackRecipe = this.generateFallbackRecipe(objective, normalizedObjective);
    this.recipes.set(fallbackRecipe.id, fallbackRecipe);
    return fallbackRecipe;
  }

  explainRecipe(recipe: Recipe): string {
    return recipe.explanation;
  }

  toPipelineSpec(recipe: Recipe): PipelineSpec {
    const components = recipe.components.map((comp, idx) => {
      const posX = 100 + idx * 200;
      const posY = 200;
      return {
        uniqueName: `${comp}_${idx + 1}`,
        componentName: comp,
        posX,
        posY,
        label: comp,
        parameters: {},
      };
    });

    const connections: Array<{ source: string; target: string; label: string }> = [];
    for (let i = 0; i < recipe.components.length - 1; i++) {
      connections.push({
        source: `${recipe.components[i]}_${i + 1}`,
        target: `${recipe.components[i + 1]}_${i + 2}`,
        label: `Flow_${i + 1}`,
      });
    }

    return {
      name: `Recipe_${recipe.id.slice(0, 8)}`,
      description: recipe.objective,
      components,
      connections,
 };
  }

  getRecipe(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }

  private findBestMatch(objective: string): PatternRecipe | null {
    let bestMatch: PatternRecipe | null = null;
    let bestScore = 0;

    for (const pattern of KNOWN_PATTERNS) {
      const score = this.calculateMatchScore(objective, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestScore >= 0.5) {
      return bestMatch;
    }

    return null;
  }

  private calculateMatchScore(objective: string, pattern: PatternRecipe): number {
    const objectiveWords = objective.split(/\s+/);
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of pattern.keywords) {
      if (objective.includes(keyword)) {
        score += 0.2;
        matchedKeywords++;
      }
    }

    for (const word of objectiveWords) {
      if (pattern.objective.includes(word)) {
        score += 0.1;
      }
    }

    const keywordCoverage = matchedKeywords / pattern.keywords.length;
    score += keywordCoverage * 0.3;

    return Math.min(score, 1.0);
  }

  private generateFallbackRecipe(objective: string, normalizedObjective: string): Recipe {
    const components = this.inferComponentsFromObjective(normalizedObjective);
    const flow = this.generateFlowFromComponents(components);

    return {
      id: crypto.randomUUID(),
      objective: objective,
      components,
      flow,
      explanation: this.generateExplanation(objective, components),
      confidence: 0.6,
    };
  }

  private inferComponentsFromObjective(objective: string): string[] {
    const components: string[] = [];

    if (this.containsAny(objective, ["csv", "archivo", "file", "delimited"])) {
      components.push("tFileInputDelimited");
    }

    if (this.containsAny(objective, ["excel", "xls", "xlsx"])) {
      components.push("tFileInputExcel");
    }

    if (this.containsAny(objective, ["xml"])) {
      components.push("tFileInputXML");
    }

    if (this.containsAny(objective, ["api", "rest", "http", "web service"])) {
      components.push("tHTTPRequest");
 if (this.containsAny(objective, ["json"])) {
        components.push("tJSONParser");
      }
    }

    if (this.containsAny(objective, ["base de datos", "mysql", "postgres", "singlestore", "oracle", "sql"])) {
      components.push("tDBInput");
    }

    if (components.length === 0) {
      components.push("tFileInputDelimited");
    }

    if (this.containsAny(objective, ["transformar", "mapear", "transform", "map"])) {
      if (!components.includes("tMap")) {
        components.push("tMap");
      }
    }

    if (this.containsAny(objective, ["filtrar", "filter", "nulos", "null", "limpiar"])) {
      if (!components.includes("tFilterRow")) {
        components.push("tFilterRow");
      }
    }

    if (this.containsAny(objective, ["agregar", "suma", "promedio", "count", "group"])) {
      if (!components.includes("tAggregateRow")) {
        components.push("tAggregateRow");
      }
    }

    if (this.containsAny(objective, ["único", "duplicados", "unique", "dedupe"])) {
      if (!components.includes("tUniqRow")) {
        components.push("tUniqRow");
      }
    }

    if (this.containsAny(objective, ["guardar", "cargar", "base de datos", "mysql", "postgres", "singlestore", "oracle", "sql", "output", "save"])) {
      if (!components.includes("tDBOutput") && !components.includes("tFileOutputDelimited")) {
        if (this.containsAny(objective, ["base de datos", "mysql", "postgres", "singlestore", "oracle", "sql"])) {
          components.push("tDBOutput");
        } else {
          components.push("tFileOutputDelimited");
        }
      }
    }

    if (this.containsAny(objective, ["archivo", "csv", "exportar", "output", "file"])) {
      if (!components.includes("tDBOutput") && !components.includes("tFileOutputDelimited")) {
        components.push("tFileOutputDelimited");
      }
    }

    if (this.containsAny(objective, ["api", "rest", "http", "enviar", "post", "put"])) {
      if (!components.includes("tHTTPRequest")) {
        components.push("tHTTPRequest");
      }
    }

    if (components.length === 0 || this.isGenericObjective(objective)) {
      return ["tFileInputDelimited", "tMap", "tFileOutputDelimited"];
    }

    return components;
  }

  private generateFlowFromComponents(components: string[]): string[] {
    const flows: string[] = [];
    for (let i = 0; i < components.length - 1; i++) {
      flows.push(`${components[i]} -> ${components[i + 1]}`);
    }
    return flows;
  }

  private generateExplanation(objective: string, components: string[]): string {
    const componentList = components.join(" -> ");
    return `Recipe generado para: "${objective}". Flujo recomendado: ${componentList}. Este flujo fue inferido automáticamente basándose en las palabras clave detectadas en el objetivo.`;
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private isGenericObjective(objective: string): boolean {
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
    return genericPatterns.some((p) => objective.includes(p)) && this.countSignificantWords(objective) <= 3;
  }

  private countSignificantWords(objective: string): number {
    const stopWords = ["de", "del", "la", "el", "en", "a", "y", "para", "con", "por", "una", "un", "los", "las"];
    const words = objective.split(/\s+/).filter((w) => !stopWords.includes(w) && w.length > 2);
    return words.length;
  }
}
