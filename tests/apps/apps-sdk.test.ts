import { test, expect, describe, beforeEach } from "bun:test";
import { createTalendMcpServer } from "../../src/presentation/server/new-server";
import { PRESENTATION_APP_DEFINITIONS } from "../../src/presentation/apps/app-registry";
import { getAllRuntimeTools } from "../../src/server/registered-tools";

let server: any;
let registeredTools: Record<string, any>;
let registeredResources: Record<string, any>;

beforeEach(() => {
  server = createTalendMcpServer();
  registeredTools = (server as any)._registeredTools;
  registeredResources = (server as any)._registeredResources;
});

describe("Talend MCP Unified Registry (SDK Integration)", () => {
  describe("1. App Launchers registration", () => {
    test("all apps have their launcherToolName registered in _registeredTools", () => {
      const canonicalTools = getAllRuntimeTools();
      const toolMap = new Map(canonicalTools.map((t) => [t.name, t]));

      for (const app of PRESENTATION_APP_DEFINITIONS) {
        const serverTool = registeredTools[app.launcherToolName];
        expect(serverTool).toBeDefined();
        // El servidor MCP registra la descripción en el objeto de la herramienta
        expect(serverTool.description).toBe(app.launchMessage);

        // Verificar metadatos en la definición canónica del registry
        const registryTool = toolMap.get(app.launcherToolName);
        expect(registryTool).toBeDefined();
        expect(registryTool?._meta).toBeDefined();
        expect(registryTool?._meta?.ui?.resourceUri).toBe(app.resourceUri);
        expect(registryTool?._meta?.["openai/outputTemplate"]).toBe(app.resourceUri);
      }
    });

    test("launcherToolNames are unique across apps", () => {
      const launcherNames = PRESENTATION_APP_DEFINITIONS.map((a) => a.launcherToolName);
      const uniqueNames = new Set(launcherNames);
      expect(uniqueNames.size).toBe(launcherNames.length);
    });
  });

  describe("2. App Resources registration", () => {
    test("all apps have their resourceUri registered in _registeredResources", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        // En el servidor MCP, las keys de _registeredResources son las URIs
        expect(registeredResources[app.resourceUri]).toBeDefined();
        expect(registeredResources[app.resourceUri].name).toBe(app.id);
      }
    });

    test("resourceUris use ui:// scheme", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.resourceUri.startsWith("ui://")).toBe(true);
      }
    });
  });

  describe("3. App Actions (Tools) registration", () => {
    test("all actions for each app are registered as tools", () => {
      const missingTools: string[] = [];
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (!registeredTools[action.toolName]) {
            missingTools.push(`${app.id}: ${action.toolName}`);
          }
        }
      }
      expect(missingTools).toEqual([]);
    });
  });

  describe("4. Canonical and Legacy Tools", () => {
    test("canonical tools are registered (e.g., talend_jobs_list)", () => {
      expect(registeredTools["talend_jobs_list"]).toBeDefined();
      expect(registeredTools["talend_snapshots_list"]).toBeDefined();
    });

    test("legacy aliases are registered (mapping legacy -> canonical)", () => {
      // talend_list_jobs es un alias de talend_jobs_list
      expect(registeredTools["talend_list_jobs"]).toBeDefined();
      // analyze_logs es un alias legacy
      expect(registeredTools["talend_analyze_logs"]).toBeDefined();
    });
  });

  describe("5. Validation of App Definitions properties", () => {
    test("each app has non-empty description and launchMessage", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.description.length).toBeGreaterThan(5);
        expect(app.launchMessage.length).toBeGreaterThan(5);
      }
    });

    test("each app has at least one action", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.actions.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("app IDs are unique", () => {
      const ids = PRESENTATION_APP_DEFINITIONS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("6. Action Payload constraints", () => {
    test("text actions have argumentName", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "text") {
            expect(action.argumentName).toBeTruthy();
          }
        }
      }
    });

    test("json actions have valid JSON defaultValue", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "json") {
            expect(action.defaultValue).toBeTruthy();
            expect(() => JSON.parse(action.defaultValue!)).not.toThrow();
          }
        }
      }
    });
  });
});
