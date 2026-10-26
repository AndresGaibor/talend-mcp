import type { TalendComponentDefinition } from "../domain/component-definition";
import { scanStudioPlugins } from "./talend-plugin/plugin-disk-scanner";

export type { PluginScanResult } from "./talend-plugin/plugin-scan-result";

/** Fachada del escáner de plugins de Talend Studio. */
export class TalendPluginScanner {
  async scanStudioPlugins(pluginsPath: string): Promise<TalendComponentDefinition[]> {
    return scanStudioPlugins(pluginsPath);
  }
}
