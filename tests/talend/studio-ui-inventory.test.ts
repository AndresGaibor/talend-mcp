import { describe, expect, test } from "bun:test";
import { buildUiInventory } from "../../src/talend/studio/tools-job-operations/studio-ui-inventory";
import {
  UI_REGISTRY_PROBE_CLASS,
  UI_REGISTRY_PROBE_SOURCE,
  UI_WIDGET_PROBE_CLASS,
  UI_WIDGET_PROBE_SOURCE,
} from "../../src/talend/studio/tools-job-operations/studio-ui-inventory-probes";

/**
 * Contrato de `talend_studio_ui_inventory`: las sondas solo miran la UI, y el
 * inventario tolera respuestas incompletas sin romper el tool.
 */
describe("talend_studio_ui_inventory", () => {
  describe("sondas", () => {
    const sources = [UI_WIDGET_PROBE_SOURCE, UI_REGISTRY_PROBE_SOURCE];

    test("cada sonda declara su clase y el punto de entrada que espera run-code", () => {
      expect(UI_WIDGET_PROBE_SOURCE).toContain(`public class ${UI_WIDGET_PROBE_CLASS}`);
      expect(UI_REGISTRY_PROBE_SOURCE).toContain(`public class ${UI_REGISTRY_PROBE_CLASS}`);
      for (const source of sources) {
        expect(source).toContain("public static Object run()");
      }
    });

    test("ninguna sonda pulsa, cierra, guarda ni cambia la seleccion", () => {
      const prohibidas = [
        "notifyListeners",
        "doClick",
        "pressButton",
        "setSelection(",
        ".close()",
        "doSave",
        ".save(",
        "setFocus",
        "execute(",
        "runCommand",
        "setText(",
        "dispose()",
        "setDirty",
        "setEnabled(",
        "setVisible(",
        "closeEditor",
        "setActive",
        "java.awt.Robot",
        "launch(",
      ];
      for (const source of sources) {
        const encontradas = prohibidas.filter((token) => source.includes(token));
        expect(encontradas, `La sonda usa llamadas que actuan sobre la UI: ${encontradas.join(", ")}`).toEqual([]);
      }
    });
  });

  describe("buildUiInventory", () => {
    test("une las dos sondas en un inventario completo", () => {
      const inventory = buildUiInventory(
        {
          windowTitle: "Talend Cloud Data Fabric",
          visibleShells: ["Talend Cloud Data Fabric | Shell"],
          menuBar: ["Archivo", "Archivo > Guardar\tCtrl+S [off]"],
          tabFolders: [{ items: ["Trabajo", "Run"], selected: "Run" }],
          toolBarTooltips: ["Feature Manager"],
          trees: [["Job Designs", "Contexts"]],
          panels: { "Run #3": ["btn:Run", "btn:Kill"] },
        },
        {
          perspectives: ["org.talend.rcp.perspective = Integration"],
          views: { total: 80, talend: ["org.talend.designer.core.codeView = Visor código"] },
          talendBundles: 282,
          dialogs: { "org.talend.designer.publish.cloud": { count: 7, sample: ["PublishWizard"] } },
        },
      );

      expect(inventory.windowTitle).toBe("Talend Cloud Data Fabric");
      expect(inventory.tabFolders[0]).toEqual({ items: ["Trabajo", "Run"], selected: "Run" });
      expect(inventory.panels["Run #3"]).toEqual(["btn:Run", "btn:Kill"]);
      expect(inventory.perspectives).toEqual(["org.talend.rcp.perspective = Integration"]);
      expect(inventory.views.total).toBe(80);
      expect(inventory.dialogs["org.talend.designer.publish.cloud"]).toEqual({ count: 7, sample: ["PublishWizard"] });
      expect(inventory.talendBundles).toBe(282);
    });

    test("sin datos devuelve un inventario vacio y no lanza", () => {
      const inventory = buildUiInventory(undefined, null);
      expect(inventory).toEqual({
        windowTitle: "",
        visibleShells: [],
        menuBar: [],
        tabFolders: [],
        toolBarTooltips: [],
        trees: [],
        panels: {},
        perspectives: [],
        views: { total: 0, talend: [] },
        talendBundles: 0,
        dialogs: {},
      });
    });

    test("descarta valores con tipo inesperado en vez de propagarlos", () => {
      const inventory = buildUiInventory(
        { menuBar: ["Archivo", 42, null], tabFolders: ["no es objeto"], trees: "x" },
        { talendBundles: "282", dialogs: { bundle: { count: "siete", sample: [1, "ok"] } } },
      );
      expect(inventory.menuBar).toEqual(["Archivo"]);
      expect(inventory.tabFolders).toEqual([{ items: [], selected: null }]);
      expect(inventory.trees).toEqual([]);
      expect(inventory.talendBundles).toBe(0);
      expect(inventory.dialogs.bundle).toEqual({ count: 0, sample: ["ok"] });
    });
  });
});
