import type { PatternRecipe } from "./types";
import { KNOWN_PATTERNS } from "./known-patterns";

/** Umbral mínimo para aceptar un patrón conocido. */
const MIN_MATCH_SCORE = 0.5;

/** True si el texto contiene alguna de las palabras clave. */
export function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/** Puntúa un patrón contra el objetivo normalizado. */
export function calculateMatchScore(objective: string, pattern: PatternRecipe): number {
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

/** Devuelve el patrón con mejor puntuación o null si ninguno supera el umbral. */
export function findBestMatch(objective: string): PatternRecipe | null {
  let bestMatch: PatternRecipe | null = null;
  let bestScore = 0;

  for (const pattern of KNOWN_PATTERNS) {
    const score = calculateMatchScore(objective, pattern);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  if (bestScore >= MIN_MATCH_SCORE) {
    return bestMatch;
  }

  return null;
}
