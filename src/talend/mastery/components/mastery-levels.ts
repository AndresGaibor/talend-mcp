import {
  calculateMasteryLevel,
  getMissingCapabilities,
  type ComponentMastery,
  type MasteryLevel,
} from "../component-mastery-types";

/** Evidencia opcional que acompaña al marcado de una capacidad. */
export type MarkEvidence = {
  source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual";
  confidence?: "high" | "medium" | "low";
  details?: unknown;
};

export type MarkableCapability = keyof ComponentMastery["levels"];

// Recalcula nivel, score y capacidades pendientes sin tocar la marca temporal.
export function recalculateMastery(mastery: ComponentMastery): void {
  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
}

// Recalcula el nivel y registra la ultima validacion.
export function recalculateMasteryWithTimestamp(mastery: ComponentMastery): void {
  recalculateMastery(mastery);
  mastery.lastValidated = Date.now();
}

// Cuenta cuantos componentes hay en cada nivel de maestria.
export function computeLevelDistribution(components: ComponentMastery[]): Record<MasteryLevel, number> {
  const levelDistribution: Record<MasteryLevel, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
  };

  for (const comp of components) {
    levelDistribution[comp.level]++;
  }

  return levelDistribution;
}
