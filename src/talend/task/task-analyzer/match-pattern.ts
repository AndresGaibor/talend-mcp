import type { PatternMatch } from "../task-types";
import type { PatternRule } from "./rule-types";

/** Compara un enunciado contra una regla y devuelve la evidencia del match. */
export function matchPattern(enunciado: string, rule: PatternRule): PatternMatch {
  const lower = enunciado.toLowerCase();
  const matchedKeywords = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const matched = matchedKeywords.length > 0;
  return {
    pattern: rule.pattern,
    matched,
    evidence: matched ? `Keywords matched: ${matchedKeywords.join(", ")}` : "No keywords matched",
    weight: matched ? rule.weight * matchedKeywords.length : 0,
  };
}
