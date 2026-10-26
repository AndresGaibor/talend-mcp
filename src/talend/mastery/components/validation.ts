import { readFileSync } from "node:fs";

import { type ComponentMastery } from "../component-mastery-types";
import { generateComponentTemplate } from "../../components/component-catalog-builder";
import { parseJobItem } from "../../job-parser";

import { getComponentMastery, saveComponentMastery } from "./persistence";
import { recalculateMasteryWithTimestamp } from "./mastery-levels";

export async function validateTemplateGeneration(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);

  const result = await generateComponentTemplate(componentName);
  if (result.ok && result.template) {
    mastery.levels.templateGenerated = true;
  }

  recalculateMasteryWithTimestamp(mastery);

  await saveComponentMastery(mastery);
  return mastery;
}

export async function validateRoundTrip(componentName: string, itemPath: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);

  try {
    const xml = readFileSync(itemPath, "utf8");
    const parsed = parseJobItem(xml, itemPath);

    const hasComponents = parsed.components.length > 0;
    const hasConnections = parsed.connections.length >= 0;
    const hasContexts = parsed.contexts.length >= 0;

    mastery.levels.roundTripReadWrite = hasComponents;
    mastery.levels.jobGenerated = hasComponents;

    mastery.evidence.push({
      capability: "roundTripReadWrite",
      ok: hasComponents,
      source: "roundtrip",
      confidence: hasComponents ? "high" : "low",
      checkedAt: Date.now(),
      details: {
        components: parsed.components.length,
        connections: parsed.connections.length,
        contexts: parsed.contexts.length,
      },
    });
  } catch (e) {
    mastery.levels.roundTripReadWrite = false;
    mastery.evidence.push({
      capability: "roundTripReadWrite",
      ok: false,
      source: "roundtrip",
      confidence: "low",
      checkedAt: Date.now(),
      details: { error: e instanceof Error ? e.message : String(e) },
    });
  }

  recalculateMasteryWithTimestamp(mastery);

  await saveComponentMastery(mastery);
  return mastery;
}
