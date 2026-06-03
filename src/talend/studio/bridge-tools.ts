import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { listFilesRecursive, readTextFile } from "../files";
import { analyzeTdbOutputs } from "../analysis";
import { inspectTalendJob } from "../inspection";
import { parseJobItem } from "../job-parser";
import { listJobs } from "../repository";
import { parseOpenJobsFromWorkbench, parseLaunchConfig } from "../open-job";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import {
  TalendStudioBridgeClient,
  type BridgeConfidence,
  type BridgeResult,
  type BridgeLaunchConfig,
} from "./bridge-client";

export type BridgeToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (input: any) => Promise<CallToolResult>;
};

type ToolEnvelope = {
  ok: boolean;
  source: string;
  confidence: BridgeConfidence;
  endpoint: string;
  data?: unknown;
  warning?: string;
  limitations?: string[];
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

function bridgeOk(payload: ToolEnvelope): CallToolResult {
  const structuredContent = payload as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

function bridgeFail(payload: ToolEnvelope): CallToolResult {
  const structuredContent = payload as Record<string, unknown>;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

function bridgeResultToEnvelope<T>(result: BridgeResult<T>, endpoint: string): ToolEnvelope {
  if (result.ok) {
    return {
      ok: true,
      source: result.source,
      confidence: result.confidence,
      endpoint,
      data: result.data,
    };
  }

  return {
    ok: false,
    source: result.source,
    confidence: result.confidence,
    endpoint,
    error: result.error,
    warning: result.error?.message,
  };
}

function buildUnavailableEnvelope(endpoint: string, warning: string, data?: unknown): ToolEnvelope {
  return {
    ok: true,
    source: "workspace-files",
    confidence: "low",
    endpoint,
    warning,
    data,
  };
}

async function loadBridge(): Promise<TalendStudioBridgeClient> {
  return await TalendStudioBridgeClient.create();
}

async function readOpenJobFallback(): Promise<{ job?: Record<string, unknown>; summary?: Record<string, unknown> }> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return {};

  const workspace = resolveWorkspaceFromProject(projectPath);
  const workbenchDir = join(workspace.metadataPath, ".plugins", "org.eclipse.e4.workbench");
  const xmiFiles = await listFilesRecursive(workbenchDir, (ruta) => ruta.endsWith(".xmi"));

  const openJobs: Array<{ jobName: string; version: string; label: string; workbenchPath: string; selected: boolean }> = [];
  for (const xmiPath of xmiFiles) {
    const xml = await readTextFile(xmiPath, workspace.workspacePath);
    openJobs.push(...parseOpenJobsFromWorkbench(xml, xmiPath));
  }

  const openJob = openJobs[0];
  if (!openJob) return { summary: { openJobs: [] } };

  const jobs = await listJobs(projectPath);
  const target = jobs.find((item) => item.label === openJob.jobName) ?? jobs[0];
  if (!target) return { job: openJob, summary: { openJobs } };

  const xml = await readTextFile(target.itemPath, projectPath);
  const parsedJob = parseJobItem(xml, target.itemPath);
  const tdbOutputs = analyzeTdbOutputs(parsedJob);
  const inspection = inspectTalendJob(parsedJob);

  return {
    job: {
      ...openJob,
      itemPath: target.itemPath,
      projectPath,
      label: target.label,
      version: target.version,
    },
    summary: {
      activeJob: target.label,
      openJobs,
      tdbOutputs,
      inspection,
    },
  };
}

async function listLaunchConfigsFallback(): Promise<BridgeLaunchConfig[]> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return [];

  const workspace = resolveWorkspaceFromProject(projectPath);
  const launchesDir = join(workspace.metadataPath, ".plugins", "org.eclipse.debug.core", ".launches");
  const launchFiles = await listFilesRecursive(launchesDir, (ruta) => ruta.endsWith(".launch"));

  const configs: BridgeLaunchConfig[] = [];
  for (const launchPath of launchFiles) {
    const xml = await readTextFile(launchPath, workspace.workspacePath);
    const parsed = parseLaunchConfig(xml, launchPath);
    configs.push({
      name: parsed.jobName,
      type: "org.eclipse.debug.core.launchConfigurationType",
      path: parsed.path,
      attributes: {
        CURRENT_PROJECT_NAME: parsed.currentProjectName ?? "",
        JOB_PROJECT_TECH_LABEL: parsed.jobProjectTechLabel ?? "",
        TALEND_JOB_ID: parsed.jobId ?? "",
        TALEND_JOB_NAME: parsed.jobName ?? "",
        TALEND_JOB_VERSION: parsed.jobVersion ?? "",
      },
    });
  }

  return configs;
}

function staticCapabilities(): Record<string, unknown> {
  return {
    workbench: {
      listEditors: true,
      activeEditor: true,
      dirtyEditors: true,
      visibleViews: true,
      selection: true,
    },
    workspace: {
      listProjects: true,
      readResources: true,
      watchResources: false,
    },
    talend: {
      detectActiveJob: true,
      readActiveJobModel: "partial",
      readComponents: "partial",
      readConnections: "partial",
      editComponents: false,
      runJob: "experimental",
    },
    commands: {
      listCommands: true,
      executeWhitelistedCommands: true,
    },
    launch: {
      listLaunchConfigs: true,
      runLaunchConfig: false,
    },
  };
}

function buildStaticLimitations(): string[] {
  return [
    "La lectura completa del modelo Talend depende de reflection y puede cambiar entre versiones.",
    "Sin el bridge instalado solo se pueden inferir datos desde archivos del workspace.",
    "La ejecución real de comandos y launches sigue bloqueada salvo whitelist.",
  ];
}

export function createStudioBridgeTools(): BridgeToolDef[] {
  return [
    {
      name: "talend_bridge_ping",
      description: "Verifica si el Talend Studio Bridge está disponible.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.ping(), "/ping");

        if (!result.ok) return bridgeFail(result);

        const isReadOnly = (await bridge.getConfig()).readOnly;
        const modeFromPayload = typeof (result.data as { mode?: unknown } | undefined)?.mode === "string"
          ? (result.data as { mode?: string }).mode
          : undefined;

        return bridgeOk({
          ...result,
          data: {
            ...(result.data as Record<string, unknown> | undefined),
            mode: modeFromPayload ?? (isReadOnly ? "readOnly" : "readWrite"),
          },
        });
      },
    },
    {
      name: "talend_bridge_capabilities",
      description: "Consulta las capacidades declaradas por el bridge y sus límites.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.capabilities(), "/capabilities");

        if (result.ok) {
          return bridgeOk({
            ...result,
            data: result.data,
          });
        }

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/capabilities",
          data: {
            capabilities: staticCapabilities(),
            limitations: buildStaticLimitations(),
          },
          warning: "Bridge no disponible; se devolvió un resumen estático.",
        });
      },
    },
    {
      name: "talend_bridge_audit_environment",
      description: "Audita Java, OSGi, Eclipse y Talend desde el bridge.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.auditEnvironment(), "/audit/environment");

        if (result.ok) return bridgeOk(result);

        const projectPath = getConfiguredProjectPath();
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: projectPath ? "medium" : "low",
          endpoint: "/audit/environment",
          warning: "Bridge no disponible; se devolvió un entorno parcialmente inferido.",
          data: {
            java: {
              version: process.version,
              vendor: "Bun/JavaScript runtime",
              home: process.env.HOME ?? process.env.USERPROFILE ?? "",
            },
            osgi: { bundleCount: 0 },
            eclipse: { product: "unknown", application: "unknown" },
            talend: {
              detectedBundles: [],
              detectedClasses: [],
              confidence: projectPath ? "low" : "unknown",
            },
          },
        });
      },
    },
    {
      name: "talend_bridge_workbench_state",
      description: "Consulta ventanas, editores, vistas y editor activo.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.workbenchState(), "/workbench/state");

        if (result.ok) return bridgeOk(result);

        const fallback = await readOpenJobFallback();
        const windows = fallback.job
          ? [
              {
                openEditors: [fallback.job],
              },
            ]
          : [];
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/workbench/state",
          warning: "Bridge no disponible. Datos inferidos desde workspace, no confirmados por Studio.",
          data: {
            windows,
            note: "activePage, dirty, editorId, shellTitle y visibleViews no se pueden confirmar cuando el bridge no está disponible.",
          },
        });
      },
    },
    {
      name: "talend_bridge_active_job_model",
      description: "Lee el modelo del job activo o devuelve un fallback desde archivos del workspace.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.activeJobModel(), "/talend/active-job/model");

        if (result.ok) return bridgeOk(result);

        const fallback = await readOpenJobFallback();
        if (!fallback.job || !fallback.summary) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/talend/active-job/model",
            error: {
              code: "NO_ACTIVE_JOB",
              message: "No se pudo detectar un job activo ni con bridge ni con archivos.",
            },
          });
        }

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/talend/active-job/model",
          warning: "Bridge no disponible; se leyó el .item del job abierto.",
          data: {
            job: fallback.job,
            ...fallback.summary,
          },
        });
      },
    },
    {
      name: "talend_bridge_commands",
      description: "Lista comandos Eclipse/Talend visibles o permitidos.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.commandsList(), "/commands/list");

        if (result.ok) return bridgeOk(result);

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/commands/list",
          warning: "Sin bridge no hay forma fiable de enumerar comandos Eclipse.",
          data: {
            commands: [
              { id: "org.eclipse.ui.file.save", name: "Save", defined: true, enabled: true },
              { id: "org.eclipse.ui.file.saveAll", name: "Save All", defined: true, enabled: true },
            ],
            limitations: ["Solo se muestran comandos conocidos localmente."],
          },
        });
      },
    },
    {
      name: "talend_bridge_launch_configs",
      description: "Lista launch configs detectadas por el bridge o por archivos .launch.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.launchConfigs(), "/launch/configs");

        if (result.ok) return bridgeOk(result);

        const configs = await listLaunchConfigsFallback();
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: configs.length > 0 ? "medium" : "low",
          endpoint: "/launch/configs",
          warning: "Bridge no disponible; se inspeccionaron archivos .launch.",
          data: { configs },
        });
      },
    },
    {
      name: "talend_bridge_selection",
      description: "Consulta la selección actual de Workbench o un fallback de archivos.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.selection(), "/workbench/selection");

        if (result.ok) return bridgeOk(result);

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/workbench/selection",
          warning: "La selección activa solo puede confirmarse con el bridge.",
          data: { selectionClass: null, selectionText: null, structuredSelection: [] },
        });
      },
    },
    {
      name: "talend_bridge_views",
      description: "Consulta las vistas visibles del Workbench o un fallback mínimo.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.views(), "/workbench/views");

        if (result.ok) return bridgeOk(result);

        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "low",
          endpoint: "/workbench/views",
          warning: "Sin bridge no se pueden enumerar las vistas activas con precisión.",
          data: { views: [] },
        });
      },
    },
    {
      name: "talend_bridge_open_resource",
      description: "Abre gráficamente un archivo (ej: .item) en el editor activo de Talend Studio.",
      inputSchema: z.object({
        path: z.string().describe("Ruta absoluta del archivo a abrir"),
      }),
      handler: async ({ path }) => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.openResource(path), "/workbench/open-resource");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_execute_command",
      description: "Ejecuta un comando Eclipse/Talend por ID (ej: org.eclipse.ui.file.saveAll, org.talend.common.runTalendElement).",
      inputSchema: z.object({
        commandId: z.string().describe("ID del comando Eclipse"),
        dryRun: z.boolean().optional().default(true).describe("Si es true, solo valida si es soportado sin ejecutar"),
      }),
      handler: async ({ commandId, dryRun }) => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.executeCommand(commandId, dryRun), "/commands/execute");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_run_launch_config",
      description: "Ejecuta una launch configuration existente (compila y ejecuta el Job).",
      inputSchema: z.object({
        name: z.string().describe("Nombre de la launch configuration (ej: 'demo_robusto 0.1')"),
        dryRun: z.boolean().optional().default(true).describe("Si es true, solo valida si existe sin ejecutar"),
        mode: z.string().optional().default("run").describe("Modo de ejecución (run o debug)"),
      }),
      handler: async ({ name, dryRun, mode }) => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.runLaunchConfig(name, dryRun, mode), "/launch/run");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_workspace_state",
      description: "Muestra el estado del workspace físico y sus proyectos asociados.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.workspaceState(), "/workspace/state");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_problems_markers",
      description: "Muestra los problemas de compilación, advertencias o errores del workspace en tiempo real.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.problemsMarkers(), "/problems/markers");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_probe_classes",
      description: "Verifica si las clases clave de Talend y Eclipse están cargadas en el OSGi runtime.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.probeClasses(), "/talend/probe/classes");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_active_editor_introspect",
      description: "Obtiene información reflexiva de métodos y propiedades del editor gráfico activo.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.activeEditorIntrospect(), "/talend/active-editor/introspect");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_events_recent",
      description: "Devuelve los últimos 100 eventos capturados por el bridge (launches, editores, procesos).",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.eventsRecent(), "/events/recent");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_events_clear",
      description: "Limpia el buffer de eventos recientes del bridge.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.eventsClear(), "/events/clear");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_save_active_editor",
      description: "Guarda el editor activo de Talend Studio si está dirty.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.saveActiveEditor(), "/workbench/save-active");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_save_all",
      description: "Guarda todos los editores dirty del workbench.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.saveAllEditors(), "/workbench/save-all");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_bridge_refresh_workspace",
      description: "Refresca el workspace de Eclipse (guarda archivos pendientes y sincroniza recursos).",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(await bridge.refreshWorkspace(), "/workspace/refresh");
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_auto_run_active_job",
      description: "Detecta el editor activo, busca su launch config, guarda si es necesario, ejecuta y opcionalmente espera terminación.",
      inputSchema: z.object({
        dryRun: z.boolean().optional().default(true).describe("Si es true, solo valida sin ejecutar realmente"),
        saveBefore: z.boolean().optional().default(true).describe("Guardar editor antes de ejecutar"),
        waitForTermination: z.boolean().optional().default(false).describe("Esperar a que el job termine"),
        timeoutMs: z.number().optional().default(30000).describe("Tiempo máximo de espera en ms"),
      }),
      handler: async ({ dryRun, saveBefore, waitForTermination, timeoutMs }) => {
        const bridge = await loadBridge();
        const result = bridgeResultToEnvelope(
          await bridge.runActiveJob({ dryRun, saveBefore, waitForTermination, timeoutMs }),
          "/automation/run-active-job"
        );
        if (result.ok) return bridgeOk(result);
        return bridgeFail(result);
      },
    },
    {
      name: "talend_sync_status",
      description: "Devuelve el estado de sincronización entre archivos y Studio activo.",
      inputSchema: z.object({}),
      handler: async () => {
        const bridge = await loadBridge();
        const { getSyncStatus } = await import("../sync/studio-file-sync");
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/sync/status",
            error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
          });
        }
        const status = await getSyncStatus(projectPath, bridge);
        return bridgeOk({
          ok: true,
          source: status.source,
          confidence: status.confidence,
          endpoint: "/sync/status",
          data: status,
        });
      },
    },
    {
      name: "talend_sync_before_file_edit",
      description: "Antes de editar archivos .item/.properties: detecta si hay job abierto, guarda si está dirty, crea snapshot.",
      inputSchema: z.object({
        itemPath: z.string().describe("Ruta al archivo .item"),
        propertiesPath: z.string().describe("Ruta al archivo .properties"),
      }),
      handler: async ({ itemPath, propertiesPath }) => {
        const bridge = await loadBridge();
        const { beforeFileEdit } = await import("../sync/studio-file-sync");
        const projectPath = getConfiguredProjectPath();
        if (!projectPath) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/sync/before-edit",
            error: { code: "NO_PROJECT", message: "No se detectó TALEND_PROJECT" },
          });
        }
        const result = await beforeFileEdit(projectPath, itemPath, propertiesPath, bridge);
        return bridgeOk({
          ok: result.ok,
          source: "mcp+studio-bridge",
          confidence: result.ok ? "high" : "low",
          endpoint: "/sync/before-edit",
          data: {
            blocked: result.blocked,
            reason: result.reason,
            snapshotCreated: result.snapshotCreated,
            snapshotPath: result.snapshotPath,
          },
        });
      },
    },
    {
      name: "talend_safe_edit_component_parameter",
      description: "Edita un parámetro de componente en XML de forma segura: snapshot, edit, refresh, validación.",
      inputSchema: z.object({
        itemPath: z.string().describe("Ruta al archivo .item del job"),
        propertiesPath: z.string().describe("Ruta al archivo .properties del job"),
        uniqueName: z.string().describe("UNIQUE_NAME del componente a editar"),
        parameterName: z.string().describe("Nombre del parámetro a modificar"),
        value: z.string().describe("Nuevo valor para el parámetro"),
      }),
      handler: async ({ itemPath, propertiesPath, uniqueName, parameterName, value }) => {
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
      handler: async ({ itemPath, propertiesPath, uniqueName, patch }) => {
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
        connectionType: z.string().describe("Tipo de conexión (FLOW, MAIN, etc)"),
      }),
      handler: async ({ itemPath, propertiesPath, sourceUniqueName, targetUniqueName, connectionType }) => {
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
              connectorName: connectionType,
              label: `${sourceUniqueName}_to_${targetUniqueName}`,
              metaname: "",
              uniqueName: `connection_${sourceUniqueName}_${targetUniqueName}_${Date.now()}`,
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
    {
      name: "talend_components_scan_installed",
      description: "Escanea los plugins de Talend Studio y construye un catálogo de componentes disponibles.",
      inputSchema: z.object({
        talendStudioPath: z.string().optional().describe("Ruta a Talend Studio (por defecto: variable TALEND_STUDIO_PATH)"),
      }),
      handler: async ({ talendStudioPath }) => {
        const { buildComponentCatalog } = await import("../components/component-catalog-builder");
        const result = await buildComponentCatalog(talendStudioPath);
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
      description: "Devuelve el estado del catálogo de componentes: cantidad de entradas, última actualización, plugins escaneados.",
      inputSchema: z.object({}),
      handler: async () => {
        const { getCatalogStatus } = await import("../components/component-catalog-builder");
        const result = await getCatalogStatus();
        return bridgeOk({
          ok: result.ok,
          source: result.ok ? "workspace-files" : "unavailable",
          confidence: result.ok ? "high" : "low",
          endpoint: "/components/status",
          data: result,
        });
      },
    },
    {
      name: "talend_components_search",
      description: "Busca componentes por nombre, familia o conector en el catálogo local.",
      inputSchema: z.object({
        query: z.string().describe("Texto a buscar"),
        maxResults: z.number().optional().default(20).describe("Máximo de resultados"),
      }),
      handler: async ({ query, maxResults }) => {
        const { searchComponents } = await import("../components/component-catalog-builder");
        const results = await searchComponents(query, maxResults);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: results.length > 0 ? "high" : "low",
          endpoint: "/components/search",
          data: { results, count: results.length },
        });
      },
    },
    {
      name: "talend_components_inspect",
      description: "Inspecciona un componente específico y devuelve sus parámetros, conectores y schemas.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente (ej: tFileInputDelimited)"),
      }),
      handler: async ({ componentName }) => {
        const { inspectComponent } = await import("../components/component-catalog-builder");
        const result = await inspectComponent(componentName);
        if (!result) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/components/inspect",
            error: { code: "COMPONENT_NOT_FOUND", message: `Componente no encontrado: ${componentName}` },
          });
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/components/inspect",
          data: result,
        });
      },
    },
    {
      name: "talend_components_parameters",
      description: "Lista todos los parámetros de un componente (requeridos y opcionales).",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
      }),
      handler: async ({ componentName }) => {
        const { getComponentParameters } = await import("../components/component-catalog-builder");
        const params = await getComponentParameters(componentName);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: params.length > 0 ? "high" : "low",
          endpoint: "/components/parameters",
          data: { componentName, parameters: params },
        });
      },
    },
    {
      name: "talend_components_connectors",
      description: "Lista los conectores disponibles de un componente.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
      }),
      handler: async ({ componentName }) => {
        const { getComponentConnectors } = await import("../components/component-catalog-builder");
        const connectors = await getComponentConnectors(componentName);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: connectors.length > 0 ? "high" : "low",
          endpoint: "/components/connectors",
          data: { componentName, connectors },
        });
      },
    },
    {
      name: "talend_components_generate_template",
      description: "Genera una plantilla JSON con los parámetros requeridos y opcionales de un componente.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
      }),
      handler: async ({ componentName }) => {
        const { generateComponentTemplate } = await import("../components/component-catalog-builder");
        const result = await generateComponentTemplate(componentName);
        if (!result.ok) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/components/template",
            error: { code: "TEMPLATE_FAILED", message: result.error ?? "Unknown error" },
          });
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/components/template",
          data: { componentName, template: JSON.parse(result.template!) },
        });
      },
    },
    {
      name: "talend_components_validate_usage",
      description: "Valida que los parámetros proporcionados sean correctos para un componente (requeridos, desconocidos).",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
        parameters: z.record(z.string(), z.string()).describe("Parámetros a validar"),
      }),
      handler: async ({ componentName, parameters }) => {
        const { validateComponentUsage } = await import("../components/component-catalog-builder");
        const result = await validateComponentUsage(componentName, parameters);
        return bridgeOk({
          ok: result.ok,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/components/validate",
          data: result,
        });
      },
    },
    {
      name: "talend_mastery_component",
      description: "Descubre y evalúa el nivel de dominio de un componente específico (0-10).",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
      }),
      handler: async ({ componentName }) => {
        const { masteryComponent } = await import("../mastery/component-mastery-runner");
        const result = await masteryComponent(componentName);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/mastery/component",
          data: result,
        });
      },
    },
    {
      name: "talend_mastery_all_components",
      description: "Ejecuta mastery en todos los componentes del catálogo y genera reporte.",
      inputSchema: z.object({}),
      handler: async () => {
        const { masteryAllComponents } = await import("../mastery/component-mastery-runner");
        const report = await masteryAllComponents();
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/mastery/all",
          data: report,
        });
      },
    },
    {
      name: "talend_mastery_report",
      description: "Devuelve el reporte de mastery con distribución de niveles y score promedio.",
      inputSchema: z.object({}),
      handler: async () => {
        const { generateMasteryReport } = await import("../mastery/component-mastery-runner");
        const report = await generateMasteryReport();
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/mastery/report",
          data: report,
        });
      },
    },
    {
      name: "talend_mastery_generate_fixture",
      description: "Genera un fixture XML mínimo válido con el componente para testing.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
      }),
      handler: async ({ componentName }) => {
        const { masteryGenerateFixture } = await import("../mastery/component-mastery-runner");
        const result = await masteryGenerateFixture(componentName);
        if (!result.ok) {
          return bridgeFail({
            ok: false,
            source: "unavailable",
            confidence: "low",
            endpoint: "/mastery/fixture",
            error: { code: "FIXTURE_FAILED", message: result.error ?? "Unknown error" },
          });
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/mastery/fixture",
          data: { componentName, fixture: result.fixture },
        });
      },
    },
    {
      name: "talend_mastery_validate_roundtrip",
      description: "Valida round-trip de un componente: genera fixture, parsea, reconstruye, verifica que el componente existe.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
        itemPath: z.string().describe("Ruta al archivo .item existente con el componente"),
      }),
      handler: async ({ componentName, itemPath }) => {
        const { validateComponentRoundtrip } = await import("../mastery/component-roundtrip-validator");
        const result = await validateComponentRoundtrip(componentName, itemPath);
        const { getComponentMastery, saveComponentMastery } = await import("../mastery/component-mastery-runner");
        const { createDefaultMastery, calculateMasteryLevel, getMissingCapabilities } = await import("../mastery/component-mastery-types");
        let mastery = await getComponentMastery(componentName);
        if (!mastery) mastery = createDefaultMastery(componentName);
        const levelBefore = mastery.level;
        if (result.roundtripValid) {
          mastery.levels.roundTripReadWrite = true;
        }
        const { level, score } = calculateMasteryLevel(mastery.levels);
        mastery.level = level;
        mastery.score = score;
        mastery.missing = getMissingCapabilities(mastery.levels);
        mastery.lastValidated = Date.now();
        await saveComponentMastery(mastery);
        return bridgeOk({
          ok: result.ok,
          source: "workspace-files",
          confidence: "medium",
          endpoint: "/mastery/validate-roundtrip",
          data: { ...result, levelBefore, levelAfter: level },
        });
      },
    },
    {
      name: "talend_mastery_validate_in_studio",
      description: "Valida que un componente abre en Studio y no genera Problems críticos.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
        itemPath: z.string().describe("Ruta al archivo .item"),
      }),
      handler: async ({ componentName, itemPath }) => {
        const { validateComponentInStudio } = await import("../mastery/component-studio-validator");
        const bridge = await loadBridge();
        const result = await validateComponentInStudio(componentName, itemPath, bridge);
        const { getComponentMastery, saveComponentMastery } = await import("../mastery/component-mastery-runner");
        const { calculateMasteryLevel, getMissingCapabilities, createDefaultMastery } = await import("../mastery/component-mastery-types");
        let mastery = await getComponentMastery(componentName);
        if (!mastery) mastery = createDefaultMastery(componentName);
        const levelBefore = mastery.level;
        if (result.opensInStudio && result.problemsCount === 0) {
          mastery.levels.opensInStudio = true;
          mastery.levels.compilesWithoutProblems = true;
        }
        mastery.evidence.push({
          capability: "opensInStudio",
          ok: result.opensInStudio,
          source: "studio-bridge",
          confidence: "high",
          checkedAt: Date.now(),
          details: { problemsCount: result.problemsCount, modelValid: result.modelValid },
        });
        const { level, score } = calculateMasteryLevel(mastery.levels);
        mastery.level = level;
        mastery.score = score;
        mastery.missing = getMissingCapabilities(mastery.levels);
        mastery.lastValidated = Date.now();
        await saveComponentMastery(mastery);
        return bridgeOk({
          ok: result.ok,
          source: result.ok ? "studio-bridge" : "unavailable",
          confidence: result.ok ? "high" : "low",
          endpoint: "/mastery/validate-in-studio",
          data: { ...result, levelBefore, levelAfter: level },
        });
      },
    },
    {
      name: "talend_mastery_validate_run",
      description: "Valida que un componente compila y ejecuta correctamente via launch config. Solo si unsafeActions=true.",
      inputSchema: z.object({
        componentName: z.string().describe("Nombre del componente"),
        itemPath: z.string().describe("Ruta al archivo .item"),
        unsafeActions: z.boolean().optional().default(false).describe("Si true, ejecuta realmente el job"),
      }),
      handler: async ({ componentName, itemPath, unsafeActions }) => {
        const { validateComponentRun } = await import("../mastery/component-run-validator");
        const bridge = await loadBridge();
        const result = await validateComponentRun(componentName, itemPath, bridge, { unsafeActions });
        const { getComponentMastery, saveComponentMastery } = await import("../mastery/component-mastery-runner");
        const { calculateMasteryLevel, getMissingCapabilities, createDefaultMastery } = await import("../mastery/component-mastery-types");
        let mastery = await getComponentMastery(componentName);
        if (!mastery) mastery = createDefaultMastery(componentName);
        const levelBefore = mastery.level;
        if (result.dryRunOk) {
          mastery.levels.runsInStudio = true;
        }
        mastery.evidence.push({
          capability: "runsInStudio",
          ok: result.dryRunOk,
          source: "launch",
          confidence: "high",
          checkedAt: Date.now(),
          details: { launchConfigFound: result.launchConfigFound, realRunOk: result.realRunOk },
        });
        const { level, score } = calculateMasteryLevel(mastery.levels);
        mastery.level = level;
        mastery.score = score;
        mastery.missing = getMissingCapabilities(mastery.levels);
        mastery.lastValidated = Date.now();
        await saveComponentMastery(mastery);
        return bridgeOk({
          ok: result.ok,
          source: result.ok ? "studio-bridge" : "unavailable",
          confidence: result.ok ? "high" : "low",
          endpoint: "/mastery/validate-run",
          data: { ...result, levelBefore, levelAfter: level },
        });
      },
    },
    {
      name: "talend_error_read_latest",
      description: "Devuelve los errores conocidos más recientes.",
      inputSchema: z.object({
        limit: z.number().optional().default(20).describe("Cantidad de errores a devolver"),
      }),
      handler: async ({ limit }) => {
        const { getLatestErrors } = await import("../diagnostics/error-knowledge-base");
        const errors = await getLatestErrors(limit);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/errors/latest",
          data: { errors, count: errors.length },
        });
      },
    },
    {
      name: "talend_error_explain",
      description: "Analiza un mensaje de error y devuelve causa y sugerencia de fix.",
      inputSchema: z.object({
        errorMessage: z.string().describe("Mensaje de error completo o parcial"),
      }),
      handler: async ({ errorMessage }) => {
        const { suggestFix, analyzeError } = await import("../diagnostics/error-knowledge-base");
        const { error, advice } = suggestFix(errorMessage);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: error ? "high" : "low",
          endpoint: "/errors/explain",
          data: { error, advice },
        });
      },
    },
    {
      name: "talend_command_catalog",
      description: "Devuelve el catálogo de comandos Eclipse/Talend con su clasificación de riesgo.",
      inputSchema: z.object({}),
      handler: async () => {
        const { getCommandCatalog } = await import("../commands/command-catalog");
        const catalog = getCommandCatalog();
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/commands/catalog",
          data: catalog,
        });
      },
    },
    {
      name: "talend_command_search",
      description: "Busca comandos por nombre, ID o categoría.",
      inputSchema: z.object({
        query: z.string().describe("Texto a buscar"),
      }),
      handler: async ({ query }) => {
        const { searchCommands } = await import("../commands/command-catalog");
        const results = searchCommands(query);
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/commands/search",
          data: { results, count: results.length },
        });
      },
    },
    {
      name: "talend_command_allow",
      description: "Permite un comando que antes estaba bloqueado.",
      inputSchema: z.object({
        commandId: z.string().describe("ID del comando a permitir"),
      }),
      handler: async ({ commandId }) => {
        const { allowCommand } = await import("../commands/command-catalog");
        const ok = allowCommand(commandId);
        return bridgeOk({
          ok,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/commands/allow",
          data: { commandId, allowed: ok },
        });
      },
    },
    {
      name: "talend_command_block",
      description: "Bloquea un comando peligroso.",
      inputSchema: z.object({
        commandId: z.string().describe("ID del comando a bloquear"),
      }),
      handler: async ({ commandId }) => {
        const { blockCommand } = await import("../commands/command-catalog");
        const ok = blockCommand(commandId);
        return bridgeOk({
          ok,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/commands/block",
          data: { commandId, blocked: ok },
        });
      },
    },
    {
      name: "talend_error_suggest_fix",
      description: "Sugiere un fix automático para un error conocido y muestra preview.",
      inputSchema: z.object({
        errorId: z.string().describe("ID del error en la knowledge base"),
        filePath: z.string().describe("Ruta al archivo .item con el problema"),
        errorMessage: z.string().describe("Mensaje de error detectado"),
      }),
      handler: async ({ errorId, filePath, errorMessage }) => {
        const { previewFix } = await import("../diagnostics/fix-planner");
        const result = await previewFix(errorId, filePath, errorMessage);
        if (!result) {
          return bridgeFail({
            ok: false,
            source: "workspace-files",
            confidence: "low",
            endpoint: "/errors/suggest-fix",
            error: { code: "NO_FIX_AVAILABLE", message: "No hay fix automático para este error o no se puede aplicar" },
          });
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/errors/suggest-fix",
          data: {
            canApply: result.canApply,
            risk: result.risk,
            changes: result.changes,
            changesCount: result.changes.length,
          },
        });
      },
    },
    {
      name: "talend_error_apply_fix",
      description: "Aplica un fix automático a un archivo .item para corregir un error conocido.",
      inputSchema: z.object({
        errorId: z.string().describe("ID del error en la knowledge base"),
        filePath: z.string().describe("Ruta al archivo .item"),
        errorMessage: z.string().describe("Mensaje de error detectado"),
      }),
      handler: async ({ errorId, filePath, errorMessage }) => {
        const { applyFix } = await import("../diagnostics/fix-planner");
        const result = await applyFix(errorId, filePath, errorMessage);
        return bridgeOk({
          ok: result.ok,
          source: "workspace-files",
          confidence: result.ok ? "high" : "low",
          endpoint: "/errors/apply-fix",
          data: {
            applied: result.applied,
            backupPath: result.backupPath,
            error: result.error,
          },
        });
      },
    },
    {
      name: "talend_error_preview_fix",
      description: "Muestra el diff de un fix antes de applied.",
      inputSchema: z.object({
        errorId: z.string().describe("ID del error en la knowledge base"),
        filePath: z.string().describe("Ruta al archivo .item"),
        errorMessage: z.string().describe("Mensaje de error detectado"),
      }),
      handler: async ({ errorId, filePath, errorMessage }) => {
        const { previewFix } = await import("../diagnostics/fix-planner");
        const result = await previewFix(errorId, filePath, errorMessage);
        if (!result) {
          return bridgeFail({
            ok: false,
            source: "workspace-files",
            confidence: "low",
            endpoint: "/errors/preview-fix",
            error: { code: "NO_FIX_AVAILABLE", message: "No hay fix disponible" },
          });
        }
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: "high",
          endpoint: "/errors/preview-fix",
          data: {
            originalContent: result.originalContent,
            proposedContent: result.proposedContent,
            changes: result.changes,
            risk: result.risk,
          },
        });
      },
    },
    {
      name: "talend_error_map_to_component",
      description: "Intenta asociar un error a un componente específico del job.",
      inputSchema: z.object({
        errorMessage: z.string().describe("Mensaje de error"),
        itemPath: z.string().describe("Ruta al archivo .item del job"),
      }),
      handler: async ({ errorMessage, itemPath }) => {
        const { readTextFile } = await import("../files");
        const { getConfiguredProjectPath } = await import("../workspace");
        const projectPath = getConfiguredProjectPath();
        if (!projectPath || !existsSync(itemPath)) {
          return bridgeOk({
            ok: true,
            source: "workspace-files",
            confidence: "low",
            endpoint: "/errors/map-to-component",
            data: { mappedComponent: null, reason: "Archivo no encontrado" },
          });
        }
        try {
          const xml = await readTextFile(itemPath, projectPath);
          const { analyzeTdbOutputs } = await import("../analysis");
          const { parseJobItem } = await import("../job-parser");
          const parsed = parseJobItem(xml, itemPath);
          const components = analyzeTdbOutputs(parsed);
          let mappedComponent = null;
          const lowerError = errorMessage.toLowerCase();
          for (const comp of components) {
            const compName = comp.componentName.toLowerCase();
            if (lowerError.includes(compName) || lowerError.includes(comp.uniqueName.toLowerCase())) {
              mappedComponent = comp.uniqueName;
              break;
            }
          }
          return bridgeOk({
            ok: true,
            source: "workspace-files",
            confidence: mappedComponent ? "high" : "low",
            endpoint: "/errors/map-to-component",
            data: { mappedComponent, reason: mappedComponent ? "Componente encontrado en mensaje de error" : "No se pudo asociar" },
          });
        } catch {
          return bridgeOk({
            ok: true,
            source: "workspace-files",
            confidence: "low",
            endpoint: "/errors/map-to-component",
            data: { mappedComponent: null, reason: "Error al parsear el job" },
          });
        }
      },
    },
  ];
}
