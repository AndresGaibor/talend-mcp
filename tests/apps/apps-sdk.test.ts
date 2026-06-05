import type { McpServer } from "@modelcontextprotocol/server";
import { test, expect, describe, beforeEach } from "bun:test";
import { createTalendMcpServer } from "../../src/presentation/server/new-server";
import { PRESENTATION_APP_DEFINITIONS } from "../../src/presentation/apps/app-registry";
import { getRegisteredServerTools } from "../../src/presentation/server/tool-registry";

let server: McpServer;
let registeredToolNames: Set<string>;

beforeEach(() => {
  server = createTalendMcpServer();
  const serverTools = getRegisteredServerTools().map((t) => t.name);
  registeredToolNames = new Set(serverTools);
});

describe("PRESENTATION_APP_DEFINITIONS", () => {
  describe("1. Cada launcher tiene tool registrada en el servidor", () => {
    test("todas las apps tienen launcherToolName registrado", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          registeredToolNames.has(app.launcherToolName),
          `${app.id} launcherToolName "${app.launcherToolName}" no está registrado`,
        ).toBe(true);
      }
    });

    test("los launcherToolName son únicos entre apps", () => {
      const launcherNames = PRESENTATION_APP_DEFINITIONS.map((a) => a.launcherToolName);
      const uniqueNames = new Set(launcherNames);
      expect(
        uniqueNames.size,
        "los launcherToolName deben ser únicos",
      ).toBe(launcherNames.length);
    });
  });

  describe("2. Cada launcher tiene _meta.ui.resourceUri", () => {
    test("cada app tiene resourceUri con formato ui://", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          app.resourceUri,
          `${app.id} debe tener resourceUri`,
        ).toBeTruthy();
        expect(
          app.resourceUri.startsWith("ui://"),
          `${app.id} resourceUri debe empezar con ui://`,
        ).toBe(true);
      }
    });
  });

  describe("3. Cada launcher tiene openai/outputTemplate", () => {
    test("los resourceUri son válidos como outputTemplate", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          app.resourceUri,
          `${app.id} debe tener resourceUri para outputTemplate`,
        ).toBeTruthy();
        expect(
          app.resourceUri.includes(".html"),
          `${app.id} resourceUri debe ser un HTML endpoint`,
        ).toBe(true);
      }
    });
  });

  describe("4. Cada resource tiene mimeType text/html;profile=mcp-app", () => {
    test("los resourceUri usan el formato ui://talend/{app}.html", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          app.resourceUri.match(/^ui:\/\/talend\/[\w-]+\.html$/),
          `${app.id} resourceUri debe seguir el patrón ui://talend/{nombre}.html`,
        ).not.toBeNull();
      }
    });

    test("todos los resourceUri terminan en .html", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          app.resourceUri.endsWith(".html"),
          `${app.id} resourceUri debe terminar en .html`,
        ).toBe(true);
      }
    });
  });

  describe("5. Cada action.toolName existe en herramientas del servidor", () => {
    test("todas las actions tienen toolName definido", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          expect(
            action.toolName,
            `${app.id} action "${action.label}" debe tener toolName`,
          ).toBeTruthy();
          expect(
            action.toolName.startsWith("talend_"),
            `${app.id} action "${action.label}" toolName "${action.toolName}" debe empezar con talend_`,
          ).toBe(true);
        }
      }
    });

    test("cada action.toolName está registrado como tool", () => {
      const errores: string[] = [];
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (!registeredToolNames.has(action.toolName)) {
            errores.push(`${app.id} -> "${action.label}" usa tool "${action.toolName}" que NO está registrado`);
          }
        }
      }
      expect(
        errores.length,
        `Las siguientes actions usan tools no registrados:\n${errores.join("\n")}`,
      ).toBe(0);
    });

    test("no hay actions duplicadas dentro de una misma app", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        const toolNames = app.actions.map((a) => a.toolName);
        const uniqueToolNames = new Set(toolNames);
        expect(
          uniqueToolNames.size,
          `${app.id} no puede tener actions con toolNames duplicados`,
        ).toBe(toolNames.length);
      }
    });
  });

  describe("6. Cada action payload valida contra inputSchema", () => {
    test("actions de tipo 'text' tienen argumentName definido", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "text") {
            expect(
              action.argumentName,
              `${app.id} action "${action.label}" con inputMode=text debe tener argumentName`,
            ).toBeTruthy();
          }
        }
      }
    });

    test("actions de tipo 'json' tienen defaultValue como string JSON válido", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "json") {
            expect(
              action.defaultValue,
              `${app.id} action "${action.label}" con inputMode=json debe tener defaultValue`,
            ).toBeTruthy();
            const defaultVal = action.defaultValue;
            expect(
              () => JSON.parse(defaultVal!),
              `${app.id} action "${action.label}" defaultValue debe ser JSON válido`,
            ).not.toThrow();
          }
        }
      }
    });

    test("actions de tipo 'none' no tienen argumentName ni defaultValue", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "none") {
            expect(
              action.argumentName,
              `${app.id} action "${action.label}" con inputMode=none no debe tener argumentName`,
            ).toBeFalsy();
            expect(
              action.defaultValue,
              `${app.id} action "${action.label}" con inputMode=none no debe tener defaultValue`,
            ).toBeFalsy();
          }
        }
      }
    });

    test("actions con requiresConfirmation tienen valor booleano", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.requiresConfirmation !== undefined) {
            expect(
              typeof action.requiresConfirmation,
              `${app.id} action "${action.label}" requiresConfirmation debe ser boolean`,
            ).toBe("boolean");
          }
        }
      }
    });

    test("actions con inputLabel tienen valor string", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputLabel !== undefined) {
            expect(
              typeof action.inputLabel,
              `${app.id} action "${action.label}" inputLabel debe ser string`,
            ).toBe("string");
          }
        }
      }
    });

    test("actions con inputPlaceholder tienen valor string", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputPlaceholder !== undefined) {
            expect(
              typeof action.inputPlaceholder,
              `${app.id} action "${action.label}" inputPlaceholder debe ser string`,
            ).toBe("string");
          }
        }
      }
    });
  });
});

describe("INVARIANTES GLOBALES", () => {
  test("PRESENTATION_APP_DEFINITIONS no debe estar vacío", () => {
    expect(PRESENTATION_APP_DEFINITIONS.length).toBeGreaterThan(0);
  });

  test("debe haber al menos 20 apps registradas", () => {
    expect(
      PRESENTATION_APP_DEFINITIONS.length,
      "debe haber al menos 20 apps",
    ).toBeGreaterThanOrEqual(20);
  });

  test("todas las apps tienen description no vacía", () => {
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      expect(
        app.description,
        `${app.id} debe tener description`,
      ).toBeTruthy();
      expect(
        app.description.length,
        `${app.id} description no puede estar vacía`,
      ).toBeGreaterThan(5);
    }
  });

  test("todas las apps tienen launchMessage no vacío", () => {
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      expect(
        app.launchMessage,
        `${app.id} debe tener launchMessage`,
      ).toBeTruthy();
      expect(
        app.launchMessage.length,
        `${app.id} launchMessage no puede estar vacío`,
      ).toBeGreaterThan(5);
    }
  });

  test("todas las apps tienen al menos una acción", () => {
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      expect(
        app.actions.length,
        `${app.id} debe tener al menos una acción`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  test("los IDs de app son únicos", () => {
    const ids = PRESENTATION_APP_DEFINITIONS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(
      uniqueIds.size,
      "los IDs de app deben ser únicos",
    ).toBe(ids.length);
  });
});