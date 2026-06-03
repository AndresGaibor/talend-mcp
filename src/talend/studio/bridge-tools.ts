import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { join } from "node:path";

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
        return bridgeOk({
          ok: true,
          source: "workspace-files",
          confidence: fallback.job ? "medium" : "low",
          endpoint: "/workbench/state",
          warning: "Bridge no disponible; se usó el workspace como referencia.",
          data: {
            windows: [
              {
                shellTitle: "Talend Studio",
                activePage: true,
                activeEditor: fallback.job
                  ? {
                      title: fallback.job.label,
                      editorId: "org.talend.designer.core.ui.editor.ProcessTalendEditor",
                      dirty: false,
                    }
                  : undefined,
                openEditors: fallback.job ? [fallback.job] : [],
                visibleViews: [],
                dirtyEditors: [],
              },
            ],
            source: "workspace-files",
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
  ];
}
