import * as z from "zod/v4";
import { existsSync } from "node:fs";
import { bridgeOk, bridgeFail, loadBridge } from "./tools-base";
import { getConfiguredProjectPath } from "../workspace";
import { findTalendJob } from "../job-crud";
import { readTextFile, writeTextFile } from "../files";
import {
  patchTalendComponentXml,
  updateTalendComponentParameterXml,
  moveTalendComponentXml
} from "../editor";
import { parseJobItem } from "../job-parser";
import { parseXml, buildXml } from "../xml";

export const componentTools = [
  {
    name: "talend_components_scan_installed",
    description: "Escanea los componentes instalados en Talend Studio.",
    inputSchema: z.object({
      pluginsDir: z.string().optional().describe("Directorio de plugins de Talend"),
    }),
    handler: async ({ pluginsDir }: { pluginsDir?: string }) => {
      const { saveComponentCatalog } = await import("../components/component-catalog-store");
      const result = await saveComponentCatalog({ pluginsDir });
      return bridgeOk({
        ok: result.ok,
        source: "workspace-files",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/scan",
        data: result,
      });
    },
  },
  {
    name: "talend_components_catalog_status",
    description: "Obtiene el estado del catálogo de componentes.",
    inputSchema: z.object({}),
    handler: async () => {
      const { getCatalogStatus } = await import("../components/component-catalog-store");
      const result = await getCatalogStatus();
      return bridgeOk({
        ok: result.ok,
        source: "workspace-files",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/catalog-status",
        data: result,
      });
    },
  },
  {
    name: "talend_components_search",
    description: "Busca componentes en el catálogo.",
    inputSchema: z.object({
      query: z.string().describe("Texto a buscar"),
      maxResults: z.number().optional().default(20).describe("Máximo de resultados"),
    }),
    handler: async ({ query, maxResults }: { query: string; maxResults?: number }) => {
      const { searchCatalog } = await import("../components/component-catalog-store");
      const results = await searchCatalog(query, maxResults);
      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/components/search",
        data: { results, count: results.length },
      });
    },
  },
  {
    name: "talend_components_inspect",
    description: "Inspecciona un componente específico.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
      const result = await inspectCatalogComponent(componentName);
      return bridgeOk({
        ok: result !== null,
        source: "workspace-files",
        confidence: result ? "high" : "low",
        endpoint: "/components/inspect",
        data: { component: result },
      });
    },
  },
  {
    name: "talend_components_parameters",
    description: "Lista los parámetros de un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
      const component = await inspectCatalogComponent(componentName);
      if (!component) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/components/parameters",
          error: { code: "NOT_FOUND", message: "Componente no encontrado: " + componentName },
        });
      }
      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/components/parameters",
        data: { parameters: component.parameters },
      });
    },
  },
  {
    name: "talend_components_connectors",
    description: "Lista los conectores de un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { inspectCatalogComponent } = await import("../components/component-catalog-store");
      const component = await inspectCatalogComponent(componentName);
      if (!component) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/components/connectors",
          error: { code: "NOT_FOUND", message: "Componente no encontrado: " + componentName },
        });
      }
      return bridgeOk({
        ok: true,
        source: "catalog",
        confidence: "high",
        endpoint: "/components/connectors",
        data: { connectors: component.connectors },
      });
    },
  },
  {
    name: "talend_components_generate_template",
    description: "Genera una plantilla de job para un componente.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
    }),
    handler: async ({ componentName }: { componentName: string }) => {
      const { masteryGenerateFixture } = await import("../mastery/component-mastery-runner");
      const result = await masteryGenerateFixture(componentName);
      return bridgeOk({
        ok: result.ok,
        source: result.ok ? "workspace-files" : "unavailable",
        confidence: result.ok ? "high" : "low",
        endpoint: "/components/generate-template",
        data: result,
      });
    },
  },
  {
    name: "talend_components_validate_usage",
    description: "Valida el uso de un componente en el proyecto.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente"),
      projectPath: z.string().optional().describe("Ruta al proyecto"),
    }),
    handler: async ({ componentName, projectPath }: { componentName: string; projectPath?: string }) => {
      const effectivePath = projectPath ?? getConfiguredProjectPath();
      if (!effectivePath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/components/validate-usage",
          error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
        });
      }
      const { searchCatalog } = await import("../components/component-catalog-store");
      const results = await searchCatalog(componentName, 1);
      const component = results[0];
      return bridgeOk({
        ok: component !== undefined,
        source: "workspace-files",
        confidence: component ? "high" : "low",
        endpoint: "/components/validate-usage",
        data: {
          found: component !== undefined,
          componentName,
          projectPath: effectivePath,
        },
      });
    },
  },
  {
    name: "talend_components_rename_label",
    description: "Cambia el label (nombre visible) de un componente Talend de forma segura.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      newLabel: z.string().describe("Nuevo LABEL visible"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, newLabel }: { jobName: string; folderPath?: string; uniqueName: string; newLabel: string }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-label",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);
      
      // Auto snapshot
      try {
        const { FileSnapshotRepository } = await import("../../modules/snapshots/adapters/file-snapshot.repository");
        const snapRepo = new FileSnapshotRepository();
        await snapRepo.create({ name: `before-rename-label-${uniqueName}`, sourcePath: job.itemPath });
      } catch (e) {
        console.warn("No se pudo crear snapshot:", e);
      }

      const newXml = updateTalendComponentParameterXml(xml, { uniqueName, parameterName: "LABEL", value: newLabel });
      await writeTextFile(job.itemPath, newXml, projectPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-label",
        data: { jobName, uniqueName, newLabel },
      });
    }
  },
  {
    name: "talend_components_preview_patch",
    description: "Muestra la previsualización (diff) de aplicar un parche de parámetros a un componente.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      patch: z.record(z.string()).describe("Patch de parámetros (clave-valor)"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, patch }: { jobName: string; folderPath?: string; uniqueName: string; patch: Record<string, string> }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/preview-patch",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);
      
      const parsedBefore = parseJobItem(xml, job.itemPath);
      const compBefore = parsedBefore.components.find(c => c.uniqueName === uniqueName);

      const newXml = patchTalendComponentXml(xml, uniqueName, patch);
      const parsedAfter = parseJobItem(newXml, job.itemPath);
      const compAfter = parsedAfter.components.find(c => c.uniqueName === uniqueName);

      const diffLines: string[] = [];
      if (compBefore && compAfter) {
        for (const key of Object.keys(patch)) {
          const valBefore = compBefore.parameters?.[key] ?? "";
          const valAfter = compAfter.parameters?.[key] ?? "";
          diffLines.push(`${key}: "${valBefore}" -> "${valAfter}"`);
        }
      }

      let riskLevel: "low" | "medium" | "high" = "low";
      const warnings: string[] = [];
      const dangerousParams = ["UNIQUE_NAME", "SCHEMA", "DBNAME", "HOST", "PORT"];
      for (const k of Object.keys(patch)) {
        if (dangerousParams.includes(k)) {
          riskLevel = "high";
          warnings.push(`El parámetro '${k}' es crítico y requiere confirmación adicional.`);
        }
      }

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/preview-patch",
        data: {
          ok: true,
          componentBefore: compBefore,
          componentAfter: compAfter,
          diff: diffLines.join("\n"),
          warnings,
          riskLevel,
        },
      });
    }
  },
  {
    name: "talend_components_apply_patch",
    description: "Aplica un parche de parámetros a un componente Talend abriendo un snapshot previo.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      patch: z.record(z.string()).describe("Patch de parámetros (clave-valor)"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, patch }: { jobName: string; folderPath?: string; uniqueName: string; patch: Record<string, string> }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/apply-patch",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);

      // Auto snapshot
      try {
        const { FileSnapshotRepository } = await import("../../modules/snapshots/adapters/file-snapshot.repository");
        const snapRepo = new FileSnapshotRepository();
        await snapRepo.create({ name: `before-patch-${uniqueName}`, sourcePath: job.itemPath });
      } catch (e) {
        console.warn("No se pudo crear snapshot:", e);
      }

      const newXml = patchTalendComponentXml(xml, uniqueName, patch);
      await writeTextFile(job.itemPath, newXml, projectPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/apply-patch",
        data: { ok: true, jobName, uniqueName, patch },
      });
    }
  },
  {
    name: "talend_components_update_position",
    description: "Actualiza la posición posX y posY de un componente Talend.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      posX: z.number().describe("Nueva posición X"),
      posY: z.number().describe("Nueva posición Y"),
    }),
    handler: async ({ jobName, folderPath, uniqueName, posX, posY }: { jobName: string; folderPath?: string; uniqueName: string; posX: number; posY: number }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/update-position",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);

      const newXml = moveTalendComponentXml(xml, { uniqueName, posX, posY });
      await writeTextFile(job.itemPath, newXml, projectPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/update-position",
        data: { ok: true, uniqueName, posX, posY },
      });
    }
  },
  {
    name: "talend_components_rename_unique_name_preview",
    description: "Genera la previsualización del cambio en cascada de UNIQUE_NAME.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      oldUniqueName: z.string().describe("UNIQUE_NAME actual"),
      newUniqueName: z.string().describe("UNIQUE_NAME propuesto"),
    }),
    handler: async ({ jobName, folderPath, oldUniqueName, newUniqueName }: { jobName: string; folderPath?: string; oldUniqueName: string; newUniqueName: string }) => {
      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-unique-name-preview",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);

      const parsed = parseJobItem(xml, job.itemPath);
      const alreadyExists = parsed.components.some(c => c.uniqueName === newUniqueName);
      if (alreadyExists) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/rename-unique-name-preview",
          error: { code: "ALREADY_EXISTS", message: `El nombre '${newUniqueName}' ya existe en este job.` }
        });
      }

      // Find connections affected
      const affectedConns = parsed.connections.filter(c => c.source === oldUniqueName || c.target === oldUniqueName);

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-unique-name-preview",
        data: {
          ok: true,
          oldUniqueName,
          newUniqueName,
          affectedConnectionsCount: affectedConns.length,
          confirmationToken: `rename_${oldUniqueName}_to_${newUniqueName}`,
          warning: "Esta operación es crítica y actualizará flujos y mapeos en cascada."
        }
      });
    }
  },
  {
    name: "talend_components_rename_unique_name_apply",
    description: "Aplica el cambio en cascada de UNIQUE_NAME usando un token de confirmación.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      folderPath: z.string().optional().describe("Ruta de la carpeta del job"),
      oldUniqueName: z.string().describe("UNIQUE_NAME actual"),
      newUniqueName: z.string().describe("UNIQUE_NAME propuesto"),
      confirmationToken: z.string().describe("Token de confirmación"),
    }),
    handler: async ({ jobName, folderPath, oldUniqueName, newUniqueName, confirmationToken }: { jobName: string; folderPath?: string; oldUniqueName: string; newUniqueName: string; confirmationToken: string }) => {
      const expectedToken = `rename_${oldUniqueName}_to_${newUniqueName}`;
      if (confirmationToken !== expectedToken) {
        return bridgeFail({
          ok: false,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/talend/components/rename-unique-name-apply",
          error: { code: "INVALID_TOKEN", message: "Token de confirmación inválido." }
        });
      }

      const projectPath = getConfiguredProjectPath();
      if (!projectPath) {
        return bridgeFail({
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint: "/talend/components/rename-unique-name-apply",
          error: { code: "NO_PROJECT", message: "TALEND_PROJECT no configurado" }
        });
      }
      const job = await findTalendJob(projectPath, jobName, folderPath);
      const xml = await readTextFile(job.itemPath, projectPath);

      // Auto snapshot
      try {
        const { FileSnapshotRepository } = await import("../../modules/snapshots/adapters/file-snapshot.repository");
        const snapRepo = new FileSnapshotRepository();
        await snapRepo.create({ name: `before-rename-uniq-${oldUniqueName}`, sourcePath: job.itemPath });
      } catch (e) {
        console.warn("No se pudo crear snapshot:", e);
      }

      const newXml = renameUniqueNameXml(xml, oldUniqueName, newUniqueName);
      await writeTextFile(job.itemPath, newXml, projectPath);

      const bridge = await loadBridge();
      await bridge.refreshWorkspace();

      return bridgeOk({
        ok: true,
        source: "workspace-files",
        confidence: "high",
        endpoint: "/talend/components/rename-unique-name-apply",
        data: { ok: true, oldUniqueName, newUniqueName },
      });
    }
  },
];

function renameUniqueNameXml(xml: string, oldUniqueName: string, newUniqueName: string): string {
  const parsed = parseXml(xml) as Record<string, any>;
  const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta ProcessType");

  const nodes = Array.isArray(root.node) ? root.node : (root.node ? [root.node] : []);
  let nodeFound = false;
  for (const node of nodes) {
    const params = Array.isArray(node.elementParameter) 
      ? node.elementParameter 
      : (node.elementParameter ? [node.elementParameter] : []);
    const uniqueParam = params.find((p: any) => p["@_name"] === "UNIQUE_NAME");
    if (uniqueParam && uniqueParam["@_value"] === oldUniqueName) {
      uniqueParam["@_value"] = newUniqueName;
      nodeFound = true;
    }
  }

  if (!nodeFound) {
    throw new Error(`Componente ${oldUniqueName} no encontrado en el job.`);
  }

  const connections = Array.isArray(root.connection) ? root.connection : (root.connection ? [root.connection] : []);
  for (const conn of connections) {
    if (conn["@_source"] === oldUniqueName) {
      conn["@_source"] = newUniqueName;
    }
    if (conn["@_target"] === oldUniqueName) {
      conn["@_target"] = newUniqueName;
    }
  }

  for (const node of nodes) {
    const params = Array.isArray(node.elementParameter) 
      ? node.elementParameter 
      : (node.elementParameter ? [node.elementParameter] : []);
    for (const p of params) {
      if (p["@_value"] && typeof p["@_value"] === "string") {
        p["@_value"] = p["@_value"].replace(new RegExp(`\\b${oldUniqueName}\\b`, "g"), newUniqueName);
      }
    }
  }

  return buildXml(parsed);
}