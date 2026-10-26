import type { TalendComponentDefinition } from "../../domain/component-definition";

/** Resultado de escanear plugins, con los errores que no interrumpen el barrido. */
export type PluginScanResult = {
  pluginId: string;
  pluginPath: string;
  components: TalendComponentDefinition[];
  errors: string[];
};
