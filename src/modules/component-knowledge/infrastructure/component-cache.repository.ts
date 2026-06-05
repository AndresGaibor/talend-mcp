import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TalendComponentDefinition } from '../domain/component-definition';

export type ComponentCacheMetadata = {
  generatedAt: number;
  talendStudioPath: string;
  componentCount: number;
  pluginCount: number;
  version: string;
};

export type ComponentCacheStatus = {
  ok: boolean;
  cachePath: string | null;
  componentCount: number;
  lastUpdated: number | null;
  errors: string[];
};

const CACHE_DIR = '.talend-mcp';
const CACHE_FILE = 'component-cache.json';
const CACHE_VERSION = '1.0.0';

function ensureCacheDir(): string {
  const dir = join(process.cwd(), CACHE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export class ComponentCacheRepository {
  private cachePath: string;

  constructor(cachePath?: string) {
    this.cachePath = cachePath ?? join(process.cwd(), CACHE_DIR, CACHE_FILE);
  }

  async save(components: TalendComponentDefinition[], talendStudioPath: string): Promise<ComponentCacheStatus> {
    const errors: string[] = [];
    const cacheDir = ensureCacheDir();
    const fullPath = join(cacheDir, CACHE_FILE);

    const uniquePlugins = new Set(components.map(c => c.source.pluginId).filter(Boolean));
    const metadata: ComponentCacheMetadata = {
      generatedAt: Date.now(),
      talendStudioPath,
      componentCount: components.length,
      pluginCount: uniquePlugins.size,
      version: CACHE_VERSION,
    };

    const cacheData = {
      metadata,
      components,
    };

    try {
      writeFileSync(fullPath, JSON.stringify(cacheData, null, 2), 'utf8');
      this.cachePath = fullPath;
    } catch (e) {
      errors.push('Error writing cache: ' + (e instanceof Error ? e.message : String(e)));
    }

    return {
      ok: errors.length === 0,
      cachePath: fullPath,
      componentCount: components.length,
      lastUpdated: metadata.generatedAt,
      errors,
    };
  }

  async load(): Promise<TalendComponentDefinition[]> {
    if (!existsSync(this.cachePath)) {
      return [];
    }

    try {
      const content = readFileSync(this.cachePath, 'utf8');
      const data = JSON.parse(content) as { components: TalendComponentDefinition[] };
      return data.components ?? [];
    } catch {
      return [];
    }
  }

  async getStatus(): Promise<ComponentCacheStatus> {
    if (!existsSync(this.cachePath)) {
      return {
        ok: false,
        cachePath: null,
        componentCount: 0,
        lastUpdated: null,
        errors: ['Cache not found. Run scan first.'],
      };
    }

    try {
      const content = readFileSync(this.cachePath, 'utf8');
      const data = JSON.parse(content) as { metadata: ComponentCacheMetadata };
      return {
        ok: true,
        cachePath: this.cachePath,
        componentCount: data.metadata?.componentCount ?? 0,
        lastUpdated: data.metadata?.generatedAt ?? null,
        errors: [],
      };
    } catch (e) {
      return {
        ok: false,
        cachePath: this.cachePath,
        componentCount: 0,
        lastUpdated: null,
        errors: ['Error reading cache: ' + (e instanceof Error ? e.message : String(e))],
      };
    }
  }

  async search(query: string, maxResults = 20): Promise<TalendComponentDefinition[]> {
    const components = await this.load();
    const lowerQuery = query.toLowerCase();

    return components
      .filter(c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.family.toLowerCase().includes(lowerQuery) ||
        c.relatedComponents.some(rc => rc.toLowerCase().includes(lowerQuery))
      )
      .slice(0, maxResults);
  }

  async findByName(name: string): Promise<TalendComponentDefinition | null> {
    const components = await this.load();
    return components.find(c => c.name === name) ?? null;
  }

  async clear(): Promise<void> {
    if (existsSync(this.cachePath)) {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(this.cachePath);
    }
  }
}
