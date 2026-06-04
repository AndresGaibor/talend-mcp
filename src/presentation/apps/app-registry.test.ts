import { test, expect, describe, beforeEach } from "bun:test";
import { createTalendMcpServer } from "../server/new-server";
import { PRESENTATION_APP_DEFINITIONS } from "./app-registry";
import { getRegisteredServerTools, getRegisteredServerToolAnnotations } from "../server/tool-registry";

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
  "talend_deliverable_create_package",
  "talend_run_job",
  "talend_auto_run_active_job",
];

let server: ReturnType<typeof createTalendMcpServer>;
let registeredToolNames: Set<string>;

beforeEach(() => {
  server = createTalendMcpServer();
  const serverTools = getRegisteredServerTools().map((t) => t.name);
  const launcherTools = PRESENTATION_APP_DEFINITIONS.map((a) => a.launcherToolName);
  registeredToolNames = new Set([...serverTools, ...launcherTools]);
});

describe("MCP Apps Registry", () => {
  describe("actions", () => {
    test("todas las acciones de apps apuntan a tools existentes", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        for (const action of app.actions) {
          expect(
            registeredToolNames.has(action.toolName),
            `${action.toolName} en ${app.id} no existe`,
          ).toBe(true);
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

    test("no hay acciones duplicadas en la misma app", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        const labels = new Set<string>();
        for (const action of app.actions) {
          expect(labels.has(action.label), `Acción duplicada "${action.label}" en ${app.id}`).toBe(false);
          labels.add(action.label);
        }
      }
    });
  });

  describe("resources", () => {
    test("cada app tiene resourceUri con formato correcto", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.resourceUri).toMatch(/^ui:\/\/talend\//);
      }
    });

    test("cada app tiene launcherToolName con formato correcto", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(app.launcherToolName).toMatch(/^talend_app_[a-z_]+$/);
      }
    });

    test("launcher tools están registrados en el servidor", () => {
      for (const app of PRESENTATION_APP_DEFINITIONS) {
        expect(
          registeredToolNames.has(app.launcherToolName),
          `${app.launcherToolName} de ${app.id} no está registrado`,
        ).toBe(true);
      }
    });
  });

  describe("tools", () => {
    test("todas las tools tienen outputSchema definido", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        expect(
          tool.outputSchema,
          `${tool.name} no tiene outputSchema`,
        ).toBeDefined();
      }
    });

    test("todas las tools de presentación (talend_*) tienen annotations", () => {
      const tools = getRegisteredServerTools().filter((t) => t.name.startsWith("talend_"));
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        expect(annotations).toBeDefined();
        expect(typeof annotations.readOnlyHint).toBe("boolean");
        expect(typeof annotations.idempotentHint).toBe("boolean");
        expect(typeof annotations.destructiveHint).toBe("boolean");
        expect(typeof annotations.openWorldHint).toBe("boolean");
      }
    });
  });

  describe("safety annotations", () => {
    test("todas las tools peligrosas no son readOnly", () => {
      for (const toolName of DANGEROUS_TOOLS) {
        if (!registeredToolNames.has(toolName)) continue;
        const annotations = getRegisteredServerToolAnnotations(toolName);
        expect(
          annotations.readOnlyHint,
          `${toolName} debería ser modificable (no readOnly)`,
        ).toBe(false);
      }
    });

    test("tools readOnly son también idempotent", () => {
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

    test("herramientas de solo lectura no son destructive", () => {
      const tools = getRegisteredServerTools();
      for (const tool of tools) {
        const annotations = getRegisteredServerToolAnnotations(tool.name);
        if (annotations.readOnlyHint) {
          expect(
            annotations.destructiveHint,
            `${tool.name} es readOnly pero destructiveHint=true`,
          ).toBe(false);
        }
      }
    });
  });
});
