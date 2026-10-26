import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { type ComponentMastery, createDefaultMastery } from "../component-mastery-types";

const MASTERY_DIR = ".talend-mcp/mastery";

function ensureMasteryDir(): string {
  const dir = join(process.cwd(), MASTERY_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function getComponentMastery(componentName: string): Promise<ComponentMastery> {
  const masteryPath = join(ensureMasteryDir(), `${componentName.replace(/[^a-zA-Z0-9]/g, "_")}.json`);

  if (existsSync(masteryPath)) {
    try {
      const content = readFileSync(masteryPath, "utf8");
      return JSON.parse(content) as ComponentMastery;
    } catch {
      return createDefaultMastery(componentName);
    }
  }

  return createDefaultMastery(componentName);
}

export async function saveComponentMastery(mastery: ComponentMastery): Promise<void> {
  const masteryPath = join(ensureMasteryDir(), `${mastery.componentName.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
  writeFileSync(masteryPath, JSON.stringify(mastery, null, 2), "utf8");
}

export async function getAllMastery(): Promise<ComponentMastery[]> {
  const masteryDir = ensureMasteryDir();
  const entries = [];

  try {
    const files = readdirSync(masteryDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = readFileSync(join(masteryDir, file), "utf8");
        entries.push(JSON.parse(content) as ComponentMastery);
      } catch {
      }
    }
  } catch {
  }

  return entries;
}
