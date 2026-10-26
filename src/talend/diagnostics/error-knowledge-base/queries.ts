import { loadKnowledgeBase, saveKnowledgeBase } from "./store";
import type { KnownError } from "./types";

/**
 * Consultas sobre el catalogo.
 *
 * `analyzeError` es la unica que escribe: registra la ocurrencia y la fecha
 * del ultimo avistamiento del error reconocido.
 */
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
