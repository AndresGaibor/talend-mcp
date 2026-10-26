import type {
  AnálisisTareaInput,
  AnálisisTareaOutput,
  PatrónTalend,
  PatternMatch,
  ResponsabilidadExterna,
  ResponsabilidadTalend,
  ToolSugerida,
} from "../task-types";
import { matchPattern } from "./match-pattern";
import { PATTERN_RULES } from "./pattern-rules";
import { buildRecommendations } from "./recommendations";

/** Confianza del analisis segun cuantos patrones y con que peso se detectaron. */
function resolveConfidence(sortedPatterns: PatternMatch[]): "low" | "medium" | "high" {
  const topPattern = sortedPatterns[0];
  if (sortedPatterns.length >= 2) return "high";
  if (sortedPatterns.length === 1 && topPattern && topPattern.weight >= 8) return "high";
  if (sortedPatterns.length === 0) return "low";
  return "medium";
}

export function analyzeTaskRequirements(input: AnálisisTareaInput): AnálisisTareaOutput {
  const rawPatternMatches: PatternMatch[] = PATTERN_RULES.map((rule) =>
    matchPattern(input.enunciado, rule)
  );

  const sortedPatterns = [...rawPatternMatches]
    .filter((m) => m.matched)
    .sort((a, b) => b.weight - a.weight);

  const patronesDetectados = sortedPatterns.map((m) => m.pattern as PatrónTalend);

  const talendResponsibilitiesSet = new Set<ResponsabilidadTalend>();
  const externalResponsibilitiesSet = new Set<ResponsabilidadExterna>();
  const suggestedToolsSet = new Set<ToolSugerida>();

  for (const matched of sortedPatterns) {
    const rule = PATTERN_RULES.find((r) => r.pattern === matched.pattern);
    if (!rule) continue;

    for (const resp of rule.talendResponsibilities) {
      talendResponsibilitiesSet.add(resp);
    }
    for (const resp of rule.externalResponsibilities) {
      externalResponsibilitiesSet.add(resp);
    }
    for (const tool of rule.suggestedTools) {
      suggestedToolsSet.add(tool);
    }
  }

  return {
    ok: true,
    talendResponsibilities: Array.from(talendResponsibilitiesSet),
    externalResponsibilities: Array.from(externalResponsibilitiesSet),
    patronesDetectados,
    suggestedTools: Array.from(suggestedToolsSet),
    confidence: resolveConfidence(sortedPatterns),
    rawPatternMatches,
    recommendations: buildRecommendations(patronesDetectados),
  };
}
