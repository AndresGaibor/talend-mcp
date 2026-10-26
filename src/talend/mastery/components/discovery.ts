import { type ComponentMastery } from "../component-mastery-types";
import { inspectComponent } from "../../components/component-catalog-builder";

import { getComponentMastery, saveComponentMastery } from "./persistence";
import { recalculateMastery } from "./mastery-levels";

export async function discoverComponent(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.discovered = true;
  mastery.lastValidated = Date.now();

  const catalogEntry = await inspectComponent(componentName);
  if (catalogEntry) {
    mastery.levels.parametersParsed = true;
  }

  recalculateMastery(mastery);

  await saveComponentMastery(mastery);
  return mastery;
}
