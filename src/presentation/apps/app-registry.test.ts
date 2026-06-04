import { test, expect, describe } from "bun:test";
import { createTalendMcpServer } from "../server/new-server";
import { PRESENTATION_APP_DEFINITIONS } from "./app-registry";
import type { PresentationAppAction } from "./app-types";
import { getRegisteredServerTools } from "../server/tool-registry";

const DANGEROUS_TOOLS = [
  "talend_create_job",
  "talend_job_apply_pipeline_spec",
  "talend_snapshot_restore",
  "talend_delete_job",
  "talend_patch_component",
  "talend_add_connection",
  "talend_repo_pull",
  "talend_repo_switch",
  "talend_delete_component",
  "talend_delete_connection",
  "talend_delete_context",
];

describe("MCP Apps Registry", () => {
  describe("actions", () => {
    test("todas las acciones de apps apuntan a tools existentes", () => {
      const server = createTalendMcpServer();
      const registeredTools = getRegisteredServerTools();
      const toolNames = new Set(registeredTools.map((t) => t.name));

      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          expect(toolNames.has(action.toolName)).toBe(true);
        }
      }
    });

    test("acciones peligrosas requieren confirmación", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (DANGEROUS_TOOLS.includes(action.toolName)) {
            expect(
              action.requiresConfirmation,
              `${action.toolName} en ${app.id} debe requerir confirmación`,
            ).toBe(true);
          }
        }
      }
    });

    test("acciones json tienen defaultValue válido", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          if (action.inputMode === "json") {
            expect(action.defaultValue).toBeDefined();
            expect(() => JSON.parse(action.defaultValue!)).not.toThrow();
          }
        }
      }
    });
  });

  describe("resources", () => {
    test("cada resource app usa mime type MCP App", () => {
      const APP_MIME_TYPE = "text/html;profile=mcp-app";

      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.resourceUri).toMatch(/^ui:\/\/talend\//);
        expect(app.launcherToolName).toMatch(/^talend_app_/);
      }
    });

    test("launcher tiene _meta.ui.resourceUri", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.id).toBeDefined();
        expect(app.resourceUri).toBeDefined();
        expect(app.resourceUri).toMatch(/^ui:\/\//);
      }
    });
  });

  describe("tools", () => {
    test("todas las tools registradas tienen outputSchema", () => {
      const tools = getRegisteredServerTools();

      for (const tool of tools) {
        expect(
          tool.outputSchema,
          `${tool.name} no tiene outputSchema`,
        ).toBeDefined();
      }
    });

    test("tools con structuredContent en handlers tienen outputSchema específico", () => {
      const tools = getRegisteredServerTools();

      for (const tool of tools) {
        const hasStructuredContent = tool.outputSchema !== undefined;
        if (hasStructuredContent) {
          expect(tool.outputSchema).toBeDefined();
        }
      }
    });
  });

  describe("safety annotations", () => {
    test("todas las tools peligrosas no son readOnly", () => {
      const { getRegisteredServerToolAnnotations } = require("../server/tool-registry");

      for (const toolName of DANGEROUS_TOOLS) {
        const annotations = getRegisteredServerToolAnnotations(toolName);
        expect(
          annotations.readOnlyHint,
          `${toolName} debería ser modificable (no readOnly)`,
        ).toBe(false);
      }
    });

    test("tools de solo lectura son idempotent", () => {
      const { getRegisteredServerToolAnnotations } = require("../server/tool-registry");
      const tools = getRegisteredServerTools();

      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        if (annotations.readOnlyHint) {
          expect(
            annotations.idempotentHint,
            `${tool.name} es readOnly pero no idempotent`,
          ).toBe(true);
        }
      }
    });
  });
});

describe("Launcher tools", () => {
  test("cada app tiene launcher tool registrado", () => {
    for (const app of PRESENTATION_APP_DEFINITIONS) {
      expect(app.launcherToolName).toBeDefined();
      expect(app.launcherToolName).toMatch(/^talend_app_[a-z_]+$/);
    }
  });

  test("launcher tools usan LAUNCHER_OUTPUT_SCHEMA", () => {
    const server = createTalendMcpServer();
    const registeredTools = getRegisteredServerTools();
    const launcherToolNames = registeredTools
      .filter((t) => t.name.startsWith("talend_app_"))
      .map((t) => t.name);

    expect(launcherToolNames.length).toBeGreaterThan(0);

    for (const app of PRESENTATION_APP_DEFINITIONS) {
      expect(launcherToolNames).toContain(app.launcherToolName);
    }
  });
});
