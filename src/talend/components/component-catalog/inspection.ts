import { inspectComponent } from "./query";
import type { ComponentParameter } from "./types";

export async function getComponentParameters(componentName: string): Promise<ComponentParameter[]> {
  const entry = await inspectComponent(componentName);
  return entry?.parameters ?? [];
}

export async function getComponentConnectors(componentName: string): Promise<string[]> {
  const entry = await inspectComponent(componentName);
  return entry?.connectors ?? [];
}
