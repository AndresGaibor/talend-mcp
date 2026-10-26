import { type ComponentMastery } from "../component-mastery-types";

import { getComponentMastery, saveComponentMastery } from "./persistence";
import {
  recalculateMasteryWithTimestamp,
  type MarkEvidence,
  type MarkableCapability,
} from "./mastery-levels";

// Marca una capacidad como validada, deja evidencia y recalcula el nivel.
async function markCapability(
  componentName: string,
  capability: MarkableCapability,
  evidence?: MarkEvidence
): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels[capability] = true;
  mastery.evidence.push({
    capability,
    ok: true,
    source: evidence?.source ?? "manual",
    confidence: evidence?.confidence ?? "low",
    checkedAt: Date.now(),
    details: evidence?.details,
  });

  recalculateMasteryWithTimestamp(mastery);

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markOpensInStudio(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "opensInStudio", evidence);
}

export async function markCompilesWithoutProblems(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "compilesWithoutProblems", evidence);
}

export async function markRunsInStudio(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "runsInStudio", evidence);
}

export async function markHandlesErrors(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "handlesErrors", evidence);
}

export async function markSafeEditingSupported(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "safeEditingSupported", evidence);
}

export async function markAutomationValidated(componentName: string, evidence?: { source?: "catalog" | "roundtrip" | "studio-bridge" | "launch" | "manual"; confidence?: "high" | "medium" | "low"; details?: unknown }): Promise<ComponentMastery> {
  return markCapability(componentName, "automationValidated", evidence);
}
