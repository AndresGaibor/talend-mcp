import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { join } from "node:path";
import { analyzeTdbOutputs, findSchemaIssues } from "./talend/analysis";
import { parseJobItem } from "./talend/job-parser";
import { parseJobProperties, listJobs } from "./talend/repository";
import { parseOpenJobsFromWorkbench } from "./talend/open-job";
import { parseLatestRunLog } from "./talend/run-logs";
import { readTextFile, listFilesRecursive, isPathInside } from "./talend/files";
import { resolveWorkspaceFromProject, getConfiguredProjectPath } from "./talend/workspace";

function makeTextContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function ok(text: string, data?: unknown): CallToolResult {
  const content = [makeTextContent(text)];
  if (data === undefined) return { content };
  if (Array.isArray(data)) {
    return { content, structuredContent: { items: data } as Record<string, unknown> };
  }
  return { content, structuredContent: data as Record<string, unknown> };
}

function okArray(text: string, data: unknown[]): CallToolResult {
  return { content: [makeTextContent(text)], structuredContent: { items: data } as Record<string, unknown> };
}

function err(text: string): CallToolResult {
  return { content: [makeTextContent(text)], isError: true };
}

async function detectOpenJobs() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const ws = resolveWorkspaceFromProject(projectPath);
  const workbenchDir = join(ws.metadataPath, ".plugins", "org.eclipse.e4.workbench");
  const xmiFiles = await listFilesRecursive(
    workbenchDir,
    (ruta) => ruta.endsWith(".xmi"),
  );
  const openJobs = [];
  for (const xmiPath of xmiFiles) {
    const xml = await readTextFile(xmiPath, ws.workspacePath);
    openJobs.push(...parseOpenJobsFromWorkbench(xml, xmiPath));
  }
  return okArray(JSON.stringify(openJobs, null, 2), openJobs);
}

async function listAllJobs() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  return ok(JSON.stringify(jobs, null, 2), { jobs });
}

async function readJob({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return ok(JSON.stringify({ ...target, ...job }, null, 2), { ...target, ...job });
}

async function listComponents({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return okArray(JSON.stringify(job.components, null, 2), job.components);
}

async function showFlow({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  const flow = job.connections.map((c) => `${c.source} -> ${c.target}`).join("\n");
  return okArray(flow, job.connections);
}

async function readContexts({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return okArray(JSON.stringify(job.contexts, null, 2), job.contexts);
}

async function analyzeTdb({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  const outputs = analyzeTdbOutputs(job);
  return okArray(JSON.stringify(outputs, null, 2), outputs);
}

async function readRunLog({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const ws = resolveWorkspaceFromProject(projectPath);
  const logPath = join(ws.metadataPath, ".log");
  if (!isPathInside(logPath, ws.workspacePath)) return err("Ruta de log fuera del workspace.");
  const logText = await readTextFile(logPath, ws.workspacePath);
  const name = jobName ?? (await listJobs(projectPath))[0]?.label ?? "";
  const latest = parseLatestRunLog(logText, name);
  return okArray(JSON.stringify(latest, null, 2), [latest]);
}

async function readJobErrors({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const ws = resolveWorkspaceFromProject(projectPath);
  const logPath = join(ws.metadataPath, ".log");
  if (!isPathInside(logPath, ws.workspacePath)) return err("Ruta de log fuera del workspace.");
  const logText = await readTextFile(logPath, ws.workspacePath);
  const name = jobName ?? (await listJobs(projectPath))[0]?.label ?? "";
  const latest = parseLatestRunLog(logText, name);
  return okArray(JSON.stringify(latest.errors, null, 2), latest.errors);
}

async function summarizeOpenJob() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const ws = resolveWorkspaceFromProject(projectPath);
  const workbenchDir = join(ws.metadataPath, ".plugins", "org.eclipse.e4.workbench");
  const xmiFiles = await listFilesRecursive(workbenchDir, (ruta) => ruta.endsWith(".xmi"));
  const openJobs = [];
  for (const xmiPath of xmiFiles) {
    const xml = await readTextFile(xmiPath, ws.workspacePath);
    openJobs.push(...parseOpenJobsFromWorkbench(xml, xmiPath));
  }
  const firstJob = openJobs[0];
  if (!firstJob) return err("No se detectó job abierto.");
  const jobs = await listJobs(projectPath);
  const target = jobs.find((j) => j.label === firstJob.jobName) ?? jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  const outputs = analyzeTdbOutputs(job);
  const tdbOutput = outputs[0];
  const issues = findSchemaIssues(job);
  const logPath = join(ws.metadataPath, ".log");
  const logText = isPathInside(logPath, ws.workspacePath)
    ? await readTextFile(logPath, ws.workspacePath)
    : "";
  const runLog = parseLatestRunLog(logText, firstJob.jobName);
  const flow = job.connections.map((c) => `${c.source} -> ${c.target}`).join(", ");
  const summary = { job: firstJob, flow, contexts: job.contexts, tdbOutput, schemaIssues: issues, runLog };
  return ok(JSON.stringify(summary, null, 2), summary);
}

export function createTalendMcpServer(): McpServer {
  const server = new McpServer({ name: "talend-mcp", version: "1.0.0" });

  server.registerTool("talend_detect_open_job", {
    description: "Detecta el job abierto actualmente en Talend Studio.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, detectOpenJobs);

  server.registerTool("talend_list_jobs", {
    description: "Lista todos los jobs del proyecto.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, listAllJobs);

  server.registerTool("talend_read_job", {
    description: "Devuelve resumen de un job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, readJob);

  server.registerTool("talend_list_components", {
    description: "Lista componentes de un job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, listComponents);

  server.registerTool("talend_show_flow", {
    description: "Muestra el flujo entre componentes.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, showFlow);

  server.registerTool("talend_read_contexts", {
    description: "Lee variables de contexto del job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, readContexts);

  server.registerTool("talend_analyze_tdboutput", {
    description: "Analiza componentes tMysqlOutput/tDBOutput.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, analyzeTdb);

  server.registerTool("talend_read_latest_run_log", {
    description: "Resume última ejecución como success/error/unknown.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, readRunLog);

  server.registerTool("talend_read_job_errors", {
    description: "Busca errores históricos en .metadata/.log.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, readJobErrors);

  server.registerTool("talend_summarize_open_job", {
    description: "Combina job abierto + flujo + contextos + tDBOutput + última ejecución.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, summarizeOpenJob);

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createTalendMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}