import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { okResult } from "../../../shared/contracts/result.contract";
import { resolveTalendPluginsDir } from "../../../talend/components/talend-paths";

const ComponentIconSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9]+$/),
});

export function createComponentIconTool(options: { pluginsDir?: string } = {}) {
  return {
    name: "talend_component_icon",
    description: "Lee el SVG original de lienzo de un componente instalado en Talend Studio. Devuelve no disponible si el recurso nativo no existe.",
    inputSchema: ComponentIconSchema,
    annotations: { readOnly: true },
    handler: async (input: z.infer<typeof ComponentIconSchema>) => {
      const pluginsDir = options.pluginsDir ?? resolveTalendPluginsDir();
      if (!pluginsDir) return okResult({ available: false }, "talend_component_icon");

      let plugins: string[];
      try {
        plugins = readdirSync(pluginsDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name.startsWith("org.talend.designer.components."))
          .map((entry) => entry.name)
          .sort((a, b) => {
            const rank = (name: string) => name.includes("localprovider") ? 0 : name.includes("bigdata") ? 1 : 2;
            return rank(a) - rank(b) || a.localeCompare(b);
          });
      } catch {
        return okResult({ available: false }, "talend_component_icon");
      }

      for (const plugin of plugins) {
        for (const relative of ["components", join("tacokit", "components")]) {
          const path = join(pluginsDir, plugin, relative, input.name, `${input.name}.svg`);
          try {
            const svg = readFileSync(path, "utf8");
            if (svg.includes("<svg")) {
              return okResult({ available: true, svg }, "talend_component_icon");
            }
          } catch {
            // El componente o el recurso no existe en este plugin.
          }
        }
      }
      return okResult({ available: false }, "talend_component_icon");
    },
  };
}
