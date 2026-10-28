import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTalendPluginsDir } from "../../../talend/components/talend-paths";
import { parseDefinitionXml } from "./definition-xml.parser";
import type {
  ComponentDefinition,
  ComponentPalette,
  DefinitionIndex,
} from "../domain/component-definition.types";

/**
 * Índice de las definiciones de componentes que hay instaladas en Studio.
 *
 * Cada plugin trae sus componentes en `components/<nombre>/<nombre>_java.xml`.
 * El índice los lee todos, los deja en memoria y los guarda en disco
 * (`.talend-mcp/component-definitions.json`) para no releerlos cada vez.
 *
 * No cubre los componentes de la generación nueva (los de AWS, JDBC,
 * Snowflake...), que vienen en archivos `.car` y no tienen XML: su
 * definición está en el código Java. Para esos, la fuente sigue siendo la
 * API de Studio (`talend_studio_component_parameters`).
 */

const CACHE_DIR = ".talend-mcp";
const CACHE_FILE = "component-definitions.json";
/** La instalación de Studio cambia muy seldom; el caché aguanta un día. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Si cambia el formato del índice, el caché viejo no sirve. */
const INDEX_VERSION = 6;

/** Del id del plugin se deduce a qué tipo de job pertenece el componente. */
function paletteOf(pluginId: string): ComponentPalette {
  const id = pluginId.toLowerCase();
  if (id.includes("sparkstrprovider")) return "SPARKSTREAMING";
  if (id.includes("structuredstreamprovider")) return "STRUCTUREDSTREAMING";
  if (id.includes("sparkprovider")) return "SPARK";
  if (id.includes("tdqsparkstprovider")) return "SPARKSTREAMING";
  if (id.includes("tdqsparkprovider")) return "SPARK";
  if (id.includes("tdqstructuredstreamprovider")) return "STRUCTUREDSTREAMING";
  if (id.includes("localprovider") || id.includes("bigdata")) return "DI";
  if (id.includes("tdqprovider") || id.includes("tisprovider") || id.includes("ipaas")) return "DI";
  if (id.includes("publish.cloud")) return "DI";
  return "OTHER";
}

/** Carpetas donde un plugin puede llevar sus componentes. */
const COMPONENT_DIRS = ["components", join("tacokit", "components")];

function listDirectories(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export type DefinitionIndexRepositoryOptions = {
  pluginsDir?: string;
  cacheDir?: string;
};

export class DefinitionIndexRepository {
  private readonly pluginsDir: string | undefined;
  private readonly cacheDir: string;
  private cached: DefinitionIndex | null = null;

  constructor(options: DefinitionIndexRepositoryOptions = {}) {
    this.pluginsDir = options.pluginsDir;
    this.cacheDir = options.cacheDir ?? join(process.cwd(), CACHE_DIR);
  }

  /** Ruta de los plugins de Studio (la de la instalación detectada). */
  resolvePluginsDir(): string | null {
    return this.pluginsDir ?? resolveTalendPluginsDir();
  }

  private get cachePath(): string {
    return join(this.cacheDir, CACHE_FILE);
  }

  /** Lee el índice de la caché si sigue vigente. */
  private readCache(): DefinitionIndex | null {
    if (this.cached) return this.cached;
    try {
      if (!existsSync(this.cachePath)) return null;
      const raw = readFileSync(this.cachePath, "utf8");
      const data = JSON.parse(raw) as DefinitionIndex;
      if (!Array.isArray(data.components)) return null;
      if (data.version !== INDEX_VERSION) return null;
      const age = Date.now() - new Date(data.generatedAt).getTime();
      if (Number.isFinite(age) && age > CACHE_TTL_MS) return null;
      this.cached = data;
      return data;
    } catch {
      return null;
    }
  }

  private writeCache(index: DefinitionIndex): void {
    try {
      if (!existsSync(this.cacheDir)) mkdirSync(this.cacheDir, { recursive: true });
      writeFileSync(this.cachePath, JSON.stringify(index), "utf8");
      this.cached = index;
    } catch {
      // El caché es una comodidad: si no se puede guardar, se sigue sin él.
    }
  }

  /**
   * Devuelve el índice de definiciones, leyéndolo del disco si hace falta.
   */
  async load(options: { refresh?: boolean } = {}): Promise<DefinitionIndex> {
    if (!options.refresh) {
      const cached = this.readCache();
      if (cached) return cached;
    }
    const built = this.scan();
    this.writeCache(built);
    return built;
  }

  /** Recorre los plugins de Studio y lee todas las definiciones. */
  scan(): DefinitionIndex {
    const pluginsDir = this.resolvePluginsDir();
    const components: ComponentDefinition[] = [];
    if (!pluginsDir) {
      return {
        version: INDEX_VERSION,
        generatedAt: new Date().toISOString(),
        pluginsDir: "",
        components,
      };
    }

    for (const pluginId of listDirectories(pluginsDir)) {
      const palette = paletteOf(pluginId);
      for (const relative of COMPONENT_DIRS) {
        const dir = join(pluginsDir, pluginId, relative);
        if (!existsSync(dir)) continue;
        for (const name of listDirectories(dir)) {
          const definitionPath = join(dir, name, `${name}_java.xml`);
          if (!existsSync(definitionPath)) continue;
          let xml: string;
          try {
            xml = readFileSync(definitionPath, "utf8");
          } catch {
            continue;
          }
          const definition = parseDefinitionXml(xml, {
            name,
            pluginId,
            palette,
            definitionPath,
          });
          if (definition) components.push(definition);
        }
      }
    }

    return {
      version: INDEX_VERSION,
      generatedAt: new Date().toISOString(),
      pluginsDir,
      components,
    };
  }

  /** Una definición por nombre; si hay varias paletas, gana la Standard. */
  async find(name: string, palette?: ComponentPalette): Promise<ComponentDefinition | null> {
    const index = await this.load();
    const candidates = index.components.filter((component) => component.name === name);
    if (candidates.length === 0) return null;
    if (palette) {
      const exact = candidates.find((component) => component.palette === palette);
      if (exact) return exact;
    }
    return (
      candidates.find((component) => component.palette === "DI") ??
      candidates.find((component) => component.palette !== "OTHER") ??
      candidates[0] ??
      null
    );
  }

  /** Definiciones que cuadran con un filtro de texto (nombre o familia). */
  async list(filter?: string, options: { palette?: ComponentPalette; limit?: number } = {}): Promise<ComponentDefinition[]> {
    const index = await this.load();
    const needle = filter?.trim().toLowerCase();
    const result = index.components.filter((component) => {
      if (options.palette && component.palette !== options.palette) return false;
      if (!needle) return true;
      return (
        component.name.toLowerCase().includes(needle) ||
        component.families.some((family) => family.toLowerCase().includes(needle))
      );
    });
    result.sort((a, b) => a.name.localeCompare(b.name));
    return options.limit ? result.slice(0, options.limit) : result;
  }

  /** Recuento por familia y por paleta: el mapa del catalogo en disco. */
  async summary(): Promise<{
    total: number;
    byPalette: Record<string, number>;
    byFamily: Record<string, number>;
    pluginsDir: string;
    generatedAt: string;
  }> {
    const index = await this.load();
    const byPalette: Record<string, number> = {};
    const byFamily: Record<string, number> = {};
    for (const component of index.components) {
      byPalette[component.palette] = (byPalette[component.palette] ?? 0) + 1;
      for (const family of component.families) {
        byFamily[family] = (byFamily[family] ?? 0) + 1;
      }
    }
    return {
      total: index.components.length,
      byPalette,
      byFamily,
      pluginsDir: index.pluginsDir,
      generatedAt: index.generatedAt,
    };
  }
}
