/** Tools de jobOperationsTools: studio-ui-inventory. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";

import {
  UI_REGISTRY_PROBE_CLASS,
  UI_REGISTRY_PROBE_SOURCE,
  UI_WIDGET_PROBE_CLASS,
  UI_WIDGET_PROBE_SOURCE,
} from "./studio-ui-inventory-probes";

export type UiInventory = {
  windowTitle: string;
  visibleShells: string[];
  menuBar: string[];
  tabFolders: { items: string[]; selected: string | null }[];
  toolBarTooltips: string[];
  trees: string[][];
  panels: Record<string, string[]>;
  perspectives: string[];
  views: { total: number; talend: string[] };
  talendBundles: number;
  dialogs: Record<string, { count: number; sample: string[] }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Une el resultado de las dos sondas en un inventario. Tolera campos ausentes:
 * una version futura del plugin puede no devolver alguno y no debe romper el tool.
 */
export function buildUiInventory(widgetsResult: unknown, registryResult: unknown): UiInventory {
  const widgets = asRecord(widgetsResult);
  const registry = asRecord(registryResult);
  const views = asRecord(registry.views);
  const dialogs = asRecord(registry.dialogs);
  const panels = asRecord(widgets.panels);

  return {
    windowTitle: typeof widgets.windowTitle === "string" ? widgets.windowTitle : "",
    visibleShells: asStrings(widgets.visibleShells),
    menuBar: asStrings(widgets.menuBar),
    tabFolders: Array.isArray(widgets.tabFolders)
      ? widgets.tabFolders.map((folder) => {
          const entry = asRecord(folder);
          return {
            items: asStrings(entry.items),
            selected: typeof entry.selected === "string" ? entry.selected : null,
          };
        })
      : [],
    toolBarTooltips: asStrings(widgets.toolBarTooltips),
    trees: Array.isArray(widgets.trees) ? widgets.trees.map(asStrings) : [],
    panels: Object.fromEntries(Object.entries(panels).map(([name, content]) => [name, asStrings(content)])),
    perspectives: asStrings(registry.perspectives),
    views: { total: typeof views.total === "number" ? views.total : 0, talend: asStrings(views.talend) },
    talendBundles: typeof registry.talendBundles === "number" ? registry.talendBundles : 0,
    dialogs: Object.fromEntries(
      Object.entries(dialogs).map(([bundle, entry]) => {
        const info = asRecord(entry);
        return [bundle, { count: typeof info.count === "number" ? info.count : 0, sample: asStrings(info.sample) }];
      }),
    ),
  };
}

export const studioUiInventory = [
  {
    name: "talend_studio_ui_inventory",
    description:
      "Inventario de solo lectura de la interfaz de Talend Studio: menus, pestanas de editor y paneles, barras de herramientas, perspectivas, vistas registradas y clases de dialogos y asistentes por bundle. No pulsa, no cierra ni guarda nada. Requiere unsafeActions=true en el bridge.",
    inputSchema: z.object({}),
    annotations: { readOnly: true },
    handler: async () => {
      const bridge = await loadBridge();
      const widgetRun = await bridge.runCode({
        code: UI_WIDGET_PROBE_SOURCE,
        className: UI_WIDGET_PROBE_CLASS,
        uiThread: true,
      });
      const registryRun = await bridge.runCode({
        code: UI_REGISTRY_PROBE_SOURCE,
        className: UI_REGISTRY_PROBE_CLASS,
      });

      const failure = [widgetRun, registryRun].find((run) => !run.ok || run.data?.ok === false);
      if (failure) {
        const payload = asRecord(failure.data);
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "medium",
          endpoint: "/automation/run-code",
          error: {
            code: "UI_INVENTORY_FAILED",
            message: String(payload.error ?? failure.error?.message ?? "La sonda de la UI no devolvio resultado"),
          },
        });
      }

      return bridgeOk({
        ok: true,
        source: "studio-bridge",
        confidence: "medium",
        endpoint: "/automation/run-code",
        data: buildUiInventory(asRecord(widgetRun.data).result, asRecord(registryRun.data).result),
      });
    },
  },
];
