import * as z from "zod/v4";
import { existsSync } from "node:fs";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";
import { readTextFile } from "../files";

export const syncTools = [
  {
    name: "talend_sync_status",
    description: "Obtiene el estado de sincronización actual.",
    inputSchema: z.object({
      projectPath: z.string().optional().describe("Ruta al proyecto Talend"),
    }),
    handler: async ({ projectPath }: { projectPath?: string }) => {
      const bridge = await loadBridge();
      const { getSyncStatus } = await import("../sync/studio-file-sync");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/sync/status",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const status = await getSyncStatus(effectivePath, bridge);
      return bridgeOk({
        ok: status.ok,
        source: status.source,
        confidence: status.confidence,
        endpoint: "/sync/status",
        data: status,
      });
    },
  },
  {
    name: "talend_sync_before_file_edit",
    description: "Prepara el estado antes de editar un archivo.",
    inputSchema: z.object({
      itemPath: z.string().describe("Ruta al archivo .item"),
      propertiesPath: z.string().describe("Ruta al archivo .properties"),
      projectPath: z.string().optional().describe("Ruta al proyecto"),
    }),
    handler: async ({ itemPath, propertiesPath, projectPath }: { itemPath: string; propertiesPath: string; projectPath?: string }) => {
      const bridge = await loadBridge();
      const { beforeFileEdit } = await import("../sync/studio-file-sync");
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/sync/before-edit",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const result = await beforeFileEdit(effectivePath, itemPath, propertiesPath, bridge);
      return bridgeOk({
        ok: result.ok,
        source: result.blocked ? "unavailable" : "mcp+studio-bridge",
        confidence: result.ok ? "high" : "low",
        endpoint: "/sync/before-edit",
        data: result,
      });
    },
  },
  {
    name: "talend_safe_edit_component_parameter",
    description: "Edita un parámetro de componente de forma segura.",
    inputSchema: z.object({
      itemPath: z.string().describe("Ruta al archivo .item"),
      propertiesPath: z.string().describe("Ruta al archivo .properties"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      parameterName: z.string().describe("Nombre del parámetro"),
      value: z.string().describe("Nuevo valor"),
    }),
    handler: async ({ itemPath, propertiesPath, uniqueName, parameterName, value }: { itemPath: string; propertiesPath: string; uniqueName: string; parameterName: string; value: string }) => {
      const bridge = await loadBridge();
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/sync/edit-parameter",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { safeEditComponentParameter } = await import("../sync/studio-file-sync");
      const { updateTalendComponentParameterXml } = await import("../editor");
      const xml = await readTextFile(itemPath, projectPath);
      const editFn = () => {
        try {
          const updatedXml = updateTalendComponentParameterXml(xml, { uniqueName, parameterName, value });
          return { ok: true, editedXml: updatedXml };
        } catch (e) {
          return { ok: false };
        }
      };
      const result = await safeEditComponentParameter(projectPath, itemPath, propertiesPath, bridge, editFn);
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/sync/edit-parameter",
        data: result,
      });
    },
  },
  {
    name: "talend_safe_patch_component",
    description: "Aplica un patch multi-parámetro a un componente de forma segura.",
    inputSchema: z.object({
      itemPath: z.string().describe("Ruta al archivo .item del job"),
      propertiesPath: z.string().describe("Ruta al archivo .properties del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente a patchear"),
      patch: z.record(z.string(), z.string()).describe("Mapa de parámetros a actualizar"),
    }),
    handler: async ({ itemPath, propertiesPath, uniqueName, patch }: { itemPath: string; propertiesPath: string; uniqueName: string; patch: Record<string, string> }) => {
      const bridge = await loadBridge();
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/sync/patch-component",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { safePatchComponent } = await import("../sync/studio-file-sync");
      const { patchTalendComponentXml } = await import("../editor");
      const xml = await readTextFile(itemPath, projectPath);
      const patchFn = () => {
        try {
          const updatedXml = patchTalendComponentXml(xml, uniqueName, patch);
          return { ok: true, patchedXml: updatedXml };
        } catch (e) {
          return { ok: false };
        }
      };
      const result = await safePatchComponent(projectPath, itemPath, propertiesPath, bridge, patchFn);
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/sync/patch-component",
        data: result,
      });
    },
  },
  {
    name: "talend_safe_add_connection",
    description: "Añade una conexión entre dos componentes de forma segura.",
    inputSchema: z.object({
      itemPath: z.string().describe("Ruta al archivo .item del job"),
      propertiesPath: z.string().describe("Ruta al archivo .properties del job"),
      sourceUniqueName: z.string().describe("UNIQUE_NAME del componente origen"),
      targetUniqueName: z.string().describe("UNIQUE_NAME del componente destino"),
      connectionType: z.string().describe("Tipo de conexión (FLOW, Main, etc)"),
    }),
    handler: async ({ itemPath, propertiesPath, sourceUniqueName, targetUniqueName, connectionType }: { itemPath: string; propertiesPath: string; sourceUniqueName: string; targetUniqueName: string; connectionType: string }) => {
      const bridge = await loadBridge();
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/sync/add-connection",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { safeAddConnection } = await import("../sync/studio-file-sync");
      const { addTalendConnectionXml } = await import("../editor");
      const xml = await readTextFile(itemPath, projectPath);
      const connFn = () => {
        try {
          const updatedXml = addTalendConnectionXml(xml, {
            sourceUniqueName,
            targetUniqueName,
            label: `${sourceUniqueName}_to_${targetUniqueName}`,
            connectorName: connectionType,
            metaname: "",
            uniqueName: `connection_${sourceUniqueName}_${targetUniqueName}`,
          });
          return { ok: true, modifiedXml: updatedXml };
        } catch (e) {
          return { ok: false };
        }
      };
      const result = await safeAddConnection(projectPath, itemPath, propertiesPath, bridge, connFn);
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/sync/add-connection",
        data: result,
      });
    },
  },
];