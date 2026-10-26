/** Receta generada a partir de un objetivo en lenguaje natural. */
export type Recipe = {
  id: string;
  objective: string;
  components: string[];
  flow: string[];
  explanation: string;
  confidence: number;
};

/** Especificación de pipeline que consume el resto del módulo. */
export type PipelineSpec = {
  name?: string;
  description?: string;
  components?: unknown[];
  connections?: unknown[];
  [key: string]: unknown;
};

/** Patrón conocido del catálogo, con las palabras que lo activan. */
export type PatternRecipe = {
  id: string;
  objective: string;
  components: string[];
  flow: string[];
  explanation: string;
  confidence: number;
  keywords: string[];
};
