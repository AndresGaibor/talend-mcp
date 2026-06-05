import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { ComponentMastery, MasteryLevel } from "../../../talend/mastery/component-mastery-types";

const MASTERY_CACHE_DIR = ".talend-mcp/mastery";
const MASTERY_INDEX_FILE = "mastery-index.json";

export type MasteryCacheMetadata = {
  generatedAt: number;
  totalComponents: number;
  lastUpdated: number;
};

export type MasteryCacheEntry = {
  componentName: string;
  mastery: ComponentMastery;
  cachedAt: number;
};

type MasteryIndex = {
  version: string;
  lastUpdated: number;
  entries: Record<string, number>;
};

const INDEX_VERSION = "1.0.0";

function ensureMasteryCacheDir(): string {
  const dir = join(process.cwd(), MASTERY_CACHE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getMasteryFilePath(componentName: string): string {
  const safeName = componentName.replace(/[^a-zA-Z0-9]/g, "_");
  return join(ensureMasteryCacheDir(), `${safeName}.json`);
}

function getIndexPath(): string {
  return join(ensureMasteryCacheDir(), MASTERY_INDEX_FILE);
}

function readIndex(): MasteryIndex {
  const indexPath = getIndexPath();
  if (!existsSync(indexPath)) {
    return { version: INDEX_VERSION, lastUpdated: Date.now(), entries: {} };
  }
  try {
    const content = readFileSync(indexPath, "utf8");
    return JSON.parse(content) as MasteryIndex;
  } catch {
    return { version: INDEX_VERSION, lastUpdated: Date.now(), entries: {} };
  }
}

function writeIndex(index: MasteryIndex): void {
  const indexPath = getIndexPath();
  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
}

export class ComponentMasteryCacheRepository {
  private cachePath: string;

  constructor(cachePath?: string) {
    this.cachePath = cachePath ?? join(process.cwd(), MASTERY_CACHE_DIR);
  }

  async saveMastery(mastery: ComponentMastery): Promise<void> {
    const filePath = getMasteryFilePath(mastery.componentName);
    const entry: MasteryCacheEntry = {
      componentName: mastery.componentName,
      mastery,
      cachedAt: Date.now(),
    };

    writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf8");

    const index = readIndex();
    index.entries[mastery.componentName] = Date.now();
    index.lastUpdated = Date.now();
    writeIndex(index);
  }

  async getMastery(componentName: string): Promise<ComponentMastery | null> {
    const filePath = getMasteryFilePath(componentName);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, "utf8");
      const entry = JSON.parse(content) as MasteryCacheEntry;
      return entry.mastery;
    } catch {
      return null;
    }
  }

  async getAllMastery(): Promise<ComponentMastery[]> {
    const dir = ensureMasteryCacheDir();
    const masteries: ComponentMastery[] = [];

    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== MASTERY_INDEX_FILE);

      for (const file of files) {
        try {
          const content = readFileSync(join(dir, file), "utf8");
          const entry = JSON.parse(content) as MasteryCacheEntry;
          masteries.push(entry.mastery);
        } catch {
        }
      }
    } catch {
    }

    return masteries;
  }

  async getMasteryByLevel(level: MasteryLevel): Promise<ComponentMastery[]> {
    const all = await this.getAllMastery();
    return all.filter((m) => m.level === level);
  }

  async getUnmasteredComponents(allComponentNames: string[]): Promise<string[]> {
    const masteries = await this.getAllMastery();
    const masteredNames = new Set(masteries.filter((m) => m.levels.discovered).map((m) => m.componentName));
    return allComponentNames.filter((name) => !masteredNames.has(name));
  }

  async clear(): Promise<void> {
    const dir = ensureMasteryCacheDir();

    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== MASTERY_INDEX_FILE);
      for (const file of files) {
        unlinkSync(join(dir, file));
      }
      unlinkSync(getIndexPath());
    } catch {
    }
  }

  async getStatus(): Promise<{ ok: boolean; totalCached: number; lastUpdated: number | null }> {
    try {
      const masteries = await this.getAllMastery();
      const index = readIndex();
      return {
        ok: true,
        totalCached: masteries.length,
        lastUpdated: index.lastUpdated || null,
      };
    } catch {
      return {
        ok: false,
        totalCached: 0,
        lastUpdated: null,
      };
    }
  }
}
