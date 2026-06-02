import { createServer } from "node:http";
import { spawn } from "node:child_process";

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";

import * as z from "zod/v4";
import { join } from "node:path";

import { analyzeTdbOutputs, findSchemaIssues } from "./talend/analysis";
import { parseJobItem } from "./talend/job-parser";
import { parseJobProperties, listJobs } from "./talend/repository";
import { parseOpenJobsFromWorkbench } from "./talend/open-job";
import { parseLatestRunLog } from "./talend/run-logs";
import { inspectTalendComponent, inspectTalendJob } from "./talend/inspection";
import { readTextFile, writeTextFile, listFilesRecursive, isPathInside } from "./talend/files";
import { resolveWorkspaceFromProject, getConfiguredProjectPath, setActiveRepo, clearActiveRepo, isRepoMode } from "./talend/workspace";
import { cloneRepo, pullRepo, getRepoInfo, discoverTalendProject, getCachedRepos, parseSource, loadState, saveState, getCacheDir } from "./talend/repo";
import {
  buildTalendComponentEditPreview,
  buildTalendContextEditPreview,
  buildTalendContextDeletePreview,
  buildTalendJobPropertiesEditPreview,
  duplicateTalendComponentXml,
  addTalendConnectionXml,
  updateTalendContextParameterXml,
  upsertTalendContextParameterXml,
  deleteTalendContextParameterXml,
  updateTalendJobPropertiesXml,
  updateTalendComponentParameterXml,
  updateTalendSchemaColumnXml,
} from "./talend/editor";

import { wrapHandler } from "./tools/live-logger";
import { resolvePublicUrl } from "./tailscale/resolve-public-url";

// ──────────────────── Helpers internos ────────────────────

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

// ──────────────────── Health / Origin Guard ────────────────────

function createHealthPayload(): Record<string, unknown> {
  return { ok: true, service: "talend-mcp" };
}

function isLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://127.0.0.1:") || origin.startsWith("http://localhost:");
}

function isOpenAIOrigin(origin: string): boolean {
  return origin === "https://chatgpt.com" || origin === "https://chat.openai.com" || origin.endsWith(".openai.com");
}

function isAllowedOrigin(origin: string | undefined, allowOrigins: string[] = []): boolean {
  if (!origin) return true;
  if (allowOrigins.includes("*")) return true;
  if (allowOrigins.includes(origin)) return true;
  return isLocalOrigin(origin) || isOpenAIOrigin(origin);
}

// ──────────────────── Tool handlers ────────────────────

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

async function inspectComponent({ jobName, uniqueName, includeRaw }: { jobName?: string; uniqueName: string; includeRaw?: boolean }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return ok(JSON.stringify(inspectTalendComponent(job, { uniqueName, includeRaw }), null, 2), inspectTalendComponent(job, { uniqueName, includeRaw }));
}

async function inspectJob({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return ok(JSON.stringify(inspectTalendJob(job), null, 2), inspectTalendJob(job));
}

async function updateComponentParameter({ jobName, uniqueName, parameterName, value }: { jobName?: string; uniqueName: string; parameterName: string; value: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = updateTalendComponentParameterXml(xml, { uniqueName, parameterName, value });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, uniqueName, parameterName, value }, null, 2), {
    itemPath: target.itemPath,
    uniqueName,
    parameterName,
    value,
  });
}

async function previewComponentParameter({ jobName, uniqueName, parameterName, value }: { jobName?: string; uniqueName: string; parameterName: string; value: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendComponentEditPreview(xml, { kind: "parameter", uniqueName, parameterName, value });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function updateSchemaColumn({ jobName, uniqueName, schemaName, columnName, patch }: { jobName?: string; uniqueName: string; schemaName: string; columnName: string; patch: { name?: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean; sourceType?: string; pattern?: string } }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = updateTalendSchemaColumnXml(xml, { uniqueName, schemaName, columnName, patch });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, uniqueName, schemaName, columnName, patch }, null, 2), {
    itemPath: target.itemPath,
    uniqueName,
    schemaName,
    columnName,
    patch,
  });
}

async function previewSchemaColumn({ jobName, uniqueName, schemaName, columnName, patch }: { jobName?: string; uniqueName: string; schemaName: string; columnName: string; patch: { name?: string; type?: string; length?: number; precision?: number; nullable?: boolean; key?: boolean; sourceType?: string; pattern?: string } }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendComponentEditPreview(xml, { kind: "schema-column", uniqueName, schemaName, columnName, patch });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function duplicateComponent({ jobName, sourceUniqueName, targetUniqueName }: { jobName?: string; sourceUniqueName: string; targetUniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = duplicateTalendComponentXml(xml, { sourceUniqueName, targetUniqueName });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, sourceUniqueName, targetUniqueName }, null, 2), {
    itemPath: target.itemPath,
    sourceUniqueName,
    targetUniqueName,
  });
}

async function addConnection({ jobName, sourceUniqueName, targetUniqueName, label, connectorName, metaname, uniqueName }: { jobName?: string; sourceUniqueName: string; targetUniqueName: string; label: string; connectorName: string; metaname: string; uniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = addTalendConnectionXml(xml, { sourceUniqueName, targetUniqueName, label, connectorName, metaname, uniqueName });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, sourceUniqueName, targetUniqueName, label, connectorName, metaname, uniqueName }, null, 2), {
    itemPath: target.itemPath,
    sourceUniqueName,
    targetUniqueName,
    label,
    connectorName,
    metaname,
    uniqueName,
  });
}

async function updateContext({ jobName, contextName, parameterName, value, type, prompt }: { jobName?: string; contextName: string; parameterName: string; value: string; type?: string; prompt?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = updateTalendContextParameterXml(xml, { contextName, parameterName, value, type, prompt });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, contextName, parameterName, value, type, prompt }, null, 2), {
    itemPath: target.itemPath,
    contextName,
    parameterName,
    value,
    type,
    prompt,
  });
}

async function upsertContext({ jobName, contextName, parameterName, value, type, prompt }: { jobName?: string; contextName: string; parameterName: string; value: string; type?: string; prompt?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = upsertTalendContextParameterXml(xml, { contextName, parameterName, value, type, prompt });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, contextName, parameterName, value, type, prompt }, null, 2), {
    itemPath: target.itemPath,
    contextName,
    parameterName,
    value,
    type,
    prompt,
  });
}

async function deleteContext({ jobName, contextName, parameterName }: { jobName?: string; contextName: string; parameterName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = deleteTalendContextParameterXml(xml, { contextName, parameterName });
  await writeTextFile(target.itemPath, updatedXml, projectPath);

  return ok(JSON.stringify({ itemPath: target.itemPath, contextName, parameterName }, null, 2), {
    itemPath: target.itemPath,
    contextName,
    parameterName,
  });
}

async function previewDeleteContext({ jobName, contextName, parameterName }: { jobName?: string; contextName: string; parameterName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendContextDeletePreview(xml, { contextName, parameterName });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function updateJobMetadata({ propertiesJobName, label, description, purpose }: { propertiesJobName?: string; label?: string; description?: string; purpose?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = propertiesJobName ? jobs.find((j) => j.label === propertiesJobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.propertiesPath, projectPath);
  const updatedXml = updateTalendJobPropertiesXml(xml, { label, description, purpose });
  await writeTextFile(target.propertiesPath, updatedXml, projectPath);

  return ok(JSON.stringify({ propertiesPath: target.propertiesPath, label, description, purpose }, null, 2), {
    propertiesPath: target.propertiesPath,
    label,
    description,
    purpose,
  });
}

async function previewContext({ jobName, contextName, parameterName, value, type, prompt, mode }: { jobName?: string; contextName: string; parameterName: string; value: string; type?: string; prompt?: string; mode: "update" | "upsert" }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendContextEditPreview(xml, { mode, contextName, parameterName, value, type, prompt });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function previewJobMetadata({ propertiesJobName, label, description, purpose }: { propertiesJobName?: string; label?: string; description?: string; purpose?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = propertiesJobName ? jobs.find((j) => j.label === propertiesJobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.propertiesPath, projectPath);
  const preview = buildTalendJobPropertiesEditPreview(xml, { label, description, purpose });
  return ok(JSON.stringify(preview, null, 2), preview);
}

// ──────────────────── Repo tool handlers ────────────────────

async function repoSources() {
  const repos = await getCachedRepos();
  const state = await loadState();
  const lines = repos.map((r) => {
    const active = r.path === state.activePath ? " (activo)" : "";
    return `  - ${r.name}${active} [${r.branch}]`;
  }).join("\n");
  return ok(`Repos en cache:\n${lines || "  (ninguno)"}`, { repos, activePath: state.activePath });
}

async function repoSetup({ source, branch, name }: { source: string; branch?: string; name?: string }) {
  const parsed = parseSource(source);
  const repoName = name ?? parsed.name;
  const targetDir = join(getCacheDir(), repoName);

  if (parsed.type === "remote") {
    await cloneRepo(source, targetDir, branch);
  }

  const info = await getRepoInfo(targetDir);
  const project = await discoverTalendProject(targetDir);
  await saveState({ activePath: targetDir, activeBranch: info.branch, activeProject: project.projectName });
  setActiveRepo(targetDir, project.projectName);

  return ok(
    `Repo "${repoName}" listo.\n  Rama: ${info.branch}\n  Commit: ${info.lastCommit}\n  Proyecto: ${project.projectName}\n  Jobs: ${project.jobCount}\n  Metadata: ${project.hasMetadata ? "sí" : "no"}`,
    { repoName, path: targetDir, info, project },
  );
}

async function repoStatus() {
  const state = await loadState();
  if (!state.activePath) return err("No hay un repo activo. Usa talend_repo_setup primero.");

  const info = await getRepoInfo(state.activePath);
  const project = await discoverTalendProject(state.activePath);
  return ok(
    `Repo activo: ${state.activeProject ?? "desconocido"}\n  Ruta: ${state.activePath}\n  Rama: ${info.branch}\n  Commit: ${info.lastCommit}\n  Remoto: ${info.hasRemote ? "sí" : "no"}\n  Jobs: ${project.jobCount}`,
    { activePath: state.activePath, activeProject: state.activeProject, info, project },
  );
}

async function repoPull() {
  const state = await loadState();
  if (!state.activePath) return err("No hay un repo activo.");

  const result = await pullRepo(state.activePath);
  const project = await discoverTalendProject(state.activePath);
  await saveState({ ...state, activeBranch: result.branch });
  setActiveRepo(state.activePath, project.projectName);

  return ok(
    `Pull completado.\n  Rama: ${result.branch}\n  Commit: ${result.lastCommit}\n  Cambios: ${result.changes}`,
    { ...result, project },
  );
}

async function repoSwitch({ name }: { name: string }) {
  const repos = await getCachedRepos();
  const target = repos.find((r) => r.name === name);
  if (!target) return err(`Repo "${name}" no encontrado en cache. Usa talend_repo_setup primero.`);

  const project = await discoverTalendProject(target.path);
  await saveState({ activePath: target.path, activeBranch: target.branch, activeProject: project.projectName });
  setActiveRepo(target.path, project.projectName);

  return ok(
    `Switcheado a "${name}".\n  Rama: ${target.branch}\n  Proyecto: ${project.projectName}\n  Jobs: ${project.jobCount}`,
    { repoName: name, path: target.path, branch: target.branch, project },
  );
}

// ──────────────────── Tool: map handler name → function ────────────────────

type ToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (input: any) => Promise<CallToolResult>;
};

const toolDefs: ToolDef[] = [
  {
    name: "talend_detect_open_job",
    description: "Detecta el job abierto actualmente en Talend Studio.",
    inputSchema: z.object({}),
    handler: detectOpenJobs,
  },
  {
    name: "talend_list_jobs",
    description: "Lista todos los jobs del proyecto.",
    inputSchema: z.object({}),
    handler: listAllJobs,
  },
  {
    name: "talend_read_job",
    description: "Devuelve resumen de un job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: readJob,
  },
  {
    name: "talend_list_components",
    description: "Lista componentes de un job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: listComponents,
  },
  {
    name: "talend_show_flow",
    description: "Muestra el flujo entre componentes.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: showFlow,
  },
  {
    name: "talend_read_contexts",
    description: "Lee variables de contexto del job.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: readContexts,
  },
  {
    name: "talend_analyze_tdboutput",
    description: "Analiza componentes tMysqlOutput/tDBOutput.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: analyzeTdb,
  },
  {
    name: "talend_read_latest_run_log",
    description: "Resume última ejecución como success/error/unknown.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: readRunLog,
  },
  {
    name: "talend_read_job_errors",
    description: "Busca errores históricos en .metadata/.log.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: readJobErrors,
  },
  {
    name: "talend_summarize_open_job",
    description: "Combina job abierto + flujo + contextos + tDBOutput + última ejecución.",
    inputSchema: z.object({}),
    handler: summarizeOpenJob,
  },
  {
    name: "talend_inspect_component",
    description: "Inspecciona un componente por uniqueName con conexiones y atributos opcionales.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string(),
      includeRaw: z.boolean().optional(),
    }),
    handler: inspectComponent,
  },
  {
    name: "talend_inspect_job",
    description: "Inspecciona un job completo con componentes, conexiones, contextos y métricas.",
    inputSchema: z.object({ jobName: z.string().optional() }),
    handler: inspectJob,
  },
  {
    name: "talend_update_component_parameter",
    description: "Actualiza un parametro existente de un componente en el .item.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string(),
      parameterName: z.string(),
      value: z.string(),
    }),
    handler: updateComponentParameter,
  },
  {
    name: "talend_preview_component_parameter",
    description: "Muestra preview y diff de un cambio de parametro sin escribir.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string(),
      parameterName: z.string(),
      value: z.string(),
    }),
    handler: previewComponentParameter,
  },
  {
    name: "talend_update_schema_column",
    description: "Actualiza una columna de schema en el .item.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string(),
      schemaName: z.string(),
      columnName: z.string(),
      patch: z.object({
        name: z.string().optional(),
        type: z.string().optional(),
        length: z.number().optional(),
        precision: z.number().optional(),
        nullable: z.boolean().optional(),
        key: z.boolean().optional(),
        sourceType: z.string().optional(),
        pattern: z.string().optional(),
      }),
    }),
    handler: updateSchemaColumn,
  },
  {
    name: "talend_preview_schema_column",
    description: "Muestra preview y diff de un cambio de schema sin escribir.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string(),
      schemaName: z.string(),
      columnName: z.string(),
      patch: z.object({
        name: z.string().optional(),
        type: z.string().optional(),
        length: z.number().optional(),
        precision: z.number().optional(),
        nullable: z.boolean().optional(),
        key: z.boolean().optional(),
        sourceType: z.string().optional(),
        pattern: z.string().optional(),
      }),
    }),
    handler: previewSchemaColumn,
  },
  {
    name: "talend_duplicate_component",
    description: "Duplica un componente y le asigna un uniqueName nuevo.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      sourceUniqueName: z.string(),
      targetUniqueName: z.string(),
    }),
    handler: duplicateComponent,
  },
  {
    name: "talend_add_connection",
    description: "Agrega una conexion entre dos componentes.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      sourceUniqueName: z.string(),
      targetUniqueName: z.string(),
      label: z.string(),
      connectorName: z.string(),
      metaname: z.string(),
      uniqueName: z.string(),
    }),
    handler: addConnection,
  },
  {
    name: "talend_update_context",
    description: "Actualiza un parametro de contexto existente.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      contextName: z.string(),
      parameterName: z.string(),
      value: z.string(),
      type: z.string().optional(),
      prompt: z.string().optional(),
    }),
    handler: updateContext,
  },
  {
    name: "talend_preview_context",
    description: "Muestra preview y diff de un cambio de contexto.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      contextName: z.string(),
      parameterName: z.string(),
      value: z.string(),
      type: z.string().optional(),
      prompt: z.string().optional(),
      mode: z.enum(["update", "upsert"]),
    }),
    handler: previewContext,
  },
  {
    name: "talend_upsert_context",
    description: "Crea o actualiza un parametro de contexto.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      contextName: z.string(),
      parameterName: z.string(),
      value: z.string(),
      type: z.string().optional(),
      prompt: z.string().optional(),
    }),
    handler: upsertContext,
  },
  {
    name: "talend_delete_context",
    description: "Borra un parametro de contexto existente.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      contextName: z.string(),
      parameterName: z.string(),
    }),
    handler: deleteContext,
  },
  {
    name: "talend_preview_delete_context",
    description: "Muestra preview y diff al borrar un parametro de contexto.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      contextName: z.string(),
      parameterName: z.string(),
    }),
    handler: previewDeleteContext,
  },
  {
    name: "talend_update_job_metadata",
    description: "Actualiza nombre, descripcion o proposito del job.",
    inputSchema: z.object({
      propertiesJobName: z.string().optional(),
      label: z.string().optional(),
      description: z.string().optional(),
      purpose: z.string().optional(),
    }),
    handler: updateJobMetadata,
  },
  {
    name: "talend_preview_job_metadata",
    description: "Muestra preview y diff de cambios de metadata del job.",
    inputSchema: z.object({
      propertiesJobName: z.string().optional(),
      label: z.string().optional(),
      description: z.string().optional(),
      purpose: z.string().optional(),
    }),
    handler: previewJobMetadata,
  },
  // ─── Repo tools ───
  {
    name: "talend_repo_sources",
    description: "Lista repos clonados en cache y muestra el activo.",
    inputSchema: z.object({}),
    handler: repoSources,
  },
  {
    name: "talend_repo_setup",
    description: "Clona o apunta a un repo git y lo activa como proyecto de lectura.",
    inputSchema: z.object({
      source: z.string().describe("URL git, ruta local, o shorthand owner/repo"),
      branch: z.string().optional().describe("Rama a clonar"),
      name: z.string().optional().describe("Nombre para el cache (default: inferido)"),
    }),
    handler: repoSetup,
  },
  {
    name: "talend_repo_status",
    description: "Muestra estado del repo activo: rama, commit, remoto, jobs.",
    inputSchema: z.object({}),
    handler: repoStatus,
  },
  {
    name: "talend_repo_pull",
    description: "Hace pull (fast-forward) del repo activo.",
    inputSchema: z.object({}),
    handler: repoPull,
  },
  {
    name: "talend_repo_switch",
    description: "Cambia el repo activo a otro ya clonado en cache.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del repo en cache (ver talend_repo_sources)"),
    }),
    handler: repoSwitch,
  },
];

// ──────────────────── Creación del servidor ────────────────────

export interface CreateServerOptions {
  live?: boolean;
  stderr?: NodeJS.WritableStream;
}

export function createTalendMcpServer(options?: CreateServerOptions): McpServer {
  const server = new McpServer({ name: "talend-mcp", version: "1.0.0" });

  const liveWriter = options?.live && options?.stderr
    ? (line: string) => { options.stderr!.write(`${line}\n`); }
    : undefined;

  // ── Guards para modo repo ──

  const writeTools = new Set([
    "talend_update_component_parameter",
    "talend_update_schema_column",
    "talend_duplicate_component",
    "talend_add_connection",
    "talend_update_context",
    "talend_upsert_context",
    "talend_update_job_metadata",
  ]);

  const workspaceTools = new Set([
    "talend_detect_open_job",
    "talend_read_latest_run_log",
    "talend_read_job_errors",
    "talend_summarize_open_job",
  ]);

  function wrapGuard(name: string, handler: (input: any) => Promise<CallToolResult>): (input: any) => Promise<CallToolResult> {
    return async (input: any) => {
      if (isRepoMode()) {
        if (writeTools.has(name)) return err("No disponible en modo repo (solo lectura). Usa TALEND_PROJECT para editar.");
        if (workspaceTools.has(name)) return err("No disponible en modo repo. Requiere un workspace de Talend Studio.");
      }
      return handler(input);
    };
  }

  for (const tool of toolDefs) {
    let handler = wrapGuard(tool.name, tool.handler);

    if (liveWriter) {
      handler = wrapHandler(tool.name, handler, liveWriter);
    }

    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    }, handler);
  }

  return server;
}

// ──────────────────── Modo stdio ────────────────────

export async function runStdioServer(options?: CreateServerOptions): Promise<void> {
  const server = createTalendMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ──────────────────── Modo HTTP ────────────────────

async function runProcess(command: string, args: string[], timeoutMs = 10_000): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0, stdout, stderr, exitCode });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr, exitCode: null });
    });
  });
}

async function detectFunnelPort(): Promise<number> {
  try {
    const existing = await runProcess("tailscale", ["funnel", "status", "--json"], 5_000);
    if (existing.ok) {
      const parsed = JSON.parse(existing.stdout) as {
        TCP?: Record<string, { HTTPS?: boolean }>;
        Web?: Record<string, unknown>;
      };
      if (parsed.TCP?.["443"]?.HTTPS) {
        return 8443;
      }
      if (parsed.Web && Object.keys(parsed.Web).some((key) => key.endsWith(":443"))) {
        return 8443;
      }
    }
  } catch {}
  return 443;
}

export interface HttpServerOptions {
  port?: number;
  host?: string;
  path?: string;
  autoFunnel?: boolean;
  allowOrigins?: string[];
  live?: boolean;
}

export interface McpServerHandle {
  localUrl: string;
  publicUrl: string | null;
  close(): Promise<void>;
}

export async function runHttpServer(options?: HttpServerOptions): Promise<McpServerHandle> {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 3927;
  const path = options?.path ?? "/mcp";
  const server = createTalendMcpServer({
    live: options?.live,
    stderr: process.stderr,
  });

  let funnelHttpsPort: number | null = null;
  let publicUrl: string | null = null;

  const httpServer = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    if (requestUrl.pathname === "/healthz") {
      const payload = createHealthPayload();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (requestUrl.pathname !== path) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }

    if (!isAllowedOrigin(req.headers.origin, options?.allowOrigins ?? [])) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "origin_denied" }));
      return;
    }

    const accept = req.headers.accept ?? "";
    if (req.method === "GET" && !accept.includes("text/event-stream")) {
      const payload = createHealthPayload();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (!accept.includes("text/event-stream")) {
      req.headers.accept = accept ? `${accept}, text/event-stream` : "application/json, text/event-stream";
    }

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  const listenPort = await new Promise<number>((resolve, reject) => {
    const listen = (nextPort: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        httpServer.off("error", onError);

        if (error.code === "EADDRINUSE" && nextPort !== 0) {
          listen(0);
          return;
        }

        reject(error);
      };

      httpServer.once("error", onError);
      httpServer.listen(nextPort, host, () => {
        httpServer.off("error", onError);

        const address = httpServer.address();
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("No se pudo determinar el puerto de escucha"));
      });
    };

    listen(port);
  });

  const localUrl = `http://${host}:${listenPort}`;

  if (options?.autoFunnel !== false) {
    const tailscaleCheck = await runProcess("tailscale", ["status", "--json"], 10_000);
    if (tailscaleCheck.ok) {
      funnelHttpsPort = await detectFunnelPort();
      await runProcess("tailscale", ["funnel", "--bg", "--yes", `--https=${funnelHttpsPort}`, String(listenPort)], 15_000);
      publicUrl = await resolvePublicUrl({
        path,
        timeoutMs: 15_000,
        intervalMs: 500,
        publicPort: funnelHttpsPort ?? undefined,
        readTailscaleStatus: async () => {
          const s = await runProcess("tailscale", ["status", "--json"], 5_000);
          return s.ok ? s.stdout : "{}";
        },
        readFunnelStatus: async () => {
          const s = await runProcess("tailscale", ["funnel", "status", "--json"], 5_000);
          return s.ok ? s.stdout : "{}";
        },
      });
    }
  }

  return {
    localUrl,
    publicUrl,
    async close() {
      if (funnelHttpsPort && funnelHttpsPort !== 443) {
        await runProcess("tailscale", ["funnel", "reset"], 5_000).catch(() => {});
      }

      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
