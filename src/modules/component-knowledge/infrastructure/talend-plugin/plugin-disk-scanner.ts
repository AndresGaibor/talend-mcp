import * as fs from "fs";
import * as path from "path";
import type { TalendComponentDefinition } from "../../domain/component-definition";
import { scanComponentsDir } from "./components-dir-scanner";
import { parseDescriptor } from "./descriptor-extractor";

/** Recorre la carpeta plugins de Studio y junta los componentes encontrados. */
export async function scanStudioPlugins(pluginsPath: string): Promise<TalendComponentDefinition[]> {
  if (!fs.existsSync(pluginsPath)) {
    return [];
  }

  const components: TalendComponentDefinition[] = [];
  const pluginDirs = fs.readdirSync(pluginsPath).filter(d => d.startsWith("org.talend"));

  for (const pluginDir of pluginDirs) {
    const pluginPath = path.join(pluginsPath, pluginDir);
    const descriptorPath = path.join(pluginPath, "descriptor.xml");

    if (fs.existsSync(descriptorPath)) {
      try {
        const parsed = await parseDescriptor(descriptorPath, pluginDir, pluginPath);
        components.push(...parsed);
      } catch (e) {
        console.warn(`Error parsing descriptor ${descriptorPath}: ${e}`);
      }
    }

    const componentsDir = path.join(pluginPath, "components");
    if (fs.existsSync(componentsDir)) {
      try {
        const dirComponents = await scanComponentsDir(componentsDir, pluginDir, pluginPath);
        components.push(...dirComponents);
      } catch (e) {
        console.warn(`Error scanning components dir ${componentsDir}: ${e}`);
      }
    }
  }

  return dedupeComponents(components);
}

/** Conserva la primera aparición de cada id de componente. */
function dedupeComponents(components: TalendComponentDefinition[]): TalendComponentDefinition[] {
  const map = new Map<string, TalendComponentDefinition>();
  for (const comp of components) {
    if (!map.has(comp.id)) {
      map.set(comp.id, comp);
    }
  }
  return [...map.values()];
}
