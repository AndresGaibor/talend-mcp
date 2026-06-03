import { createServer } from "node:http";
import { spawn } from "node:child_process";

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";

import * as z from "zod/v4";
import { join } from "node:path";

import { analyzeTdbOutputs, findSchemaIssues } from "./talend/analysis";
import { listDQAnalyses, parseDQAnalysis, formatDQAnalysis, formatDQAnalysesList } from "./talend/dq-analysis";
import { updateDQAnalysisFiles, duplicateDQAnalysisFiles } from "./talend/dq-crud";
import { formatProjectContexts, listProjectContexts } from "./talend/project-contexts";
import { parseJobItem } from "./talend/job-parser";
import { parseJobProperties, listJobs } from "./talend/repository";
import { parseOpenJobsFromWorkbench } from "./talend/open-job";
import { parseLatestRunLog } from "./talend/run-logs";
import { analyzeJobLogs, readLogContent, findJobLogFile, formatLogLines, type LogFileInfo } from "./talend/log-viewer";
import { analyzeJob, formatAnalysis, type FullJobAnalysis } from "./talend/talend-analysis";
import { inspectTalendComponent, inspectTalendJob } from "./talend/inspection";
import { readTextFile, writeTextFile, listFilesRecursive, isPathInside } from "./talend/files";
import { resolveWorkspaceFromProject, getConfiguredProjectPath, setActiveRepo, clearActiveRepo, isRepoMode } from "./talend/workspace";
import { cloneRepo, pullRepo, getRepoInfo, discoverTalendProject, getCachedRepos, parseSource, loadState, saveState, getCacheDir } from "./talend/repo";
import { runJob, getJobExecutionInfo } from "./talend/executor";
import { createTalendFolder, createTalendJob, findTalendJob, renameTalendJob, deleteTalendJob, duplicateTalendJob, moveTalendJobToFolder } from "./talend/job-crud";
import { buildJobItemXml, buildJobPropertiesXml, validateJobSpec, type JobSpec } from "./talend/job-generator";
import { COMPONENT_REGISTRY, getComponentSnippet } from "./talend/component-registry";
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
  patchTalendComponentXml,
  updateTalendSchemaColumnXml,
  deleteTalendComponentXml,
  deleteTalendConnectionXml,
  moveTalendComponentXml,
  buildTalendComponentDeletePreview,
  buildTalendConnectionDeletePreview,
} from "./talend/editor";

import {
  formatRepositoryContext,
  formatRepositoryContextList,
  listRepositoryContexts,
  readRepositoryContext,
  createRepositoryContext,
  updateRepositoryContextParameter,
  upsertRepositoryContextParameter,
  deleteRepositoryContextParameter,
  deleteRepositoryContext,
} from "./talend/repository-contexts";
import { createStudioBridgeTools } from "./talend/studio/bridge-tools";
import { studioToolDefs } from "./tools/new-tools";

import { parseXml, buildXml, asArray } from "./talend/xml";
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

async function readJob({ jobName, folderPath }: { jobName?: string; folderPath?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const target = jobName ? await findTalendJob(projectPath, jobName, folderPath) : (await listJobs(projectPath))[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  return ok(JSON.stringify({ ...target, ...job }, null, 2), { ...target, ...job });
}

async function createFolderHandler({ folderPath }: { folderPath: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = createTalendFolder(projectPath, folderPath);
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error creando carpeta: ${e}`);
  }
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

async function listProjectContextsHandler() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const contexts = await listProjectContexts(projectPath);
  return ok(formatProjectContexts(contexts), contexts);
}

async function listRepositoryContextsHandler() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const contexts = await listRepositoryContexts(projectPath);
  return ok(formatRepositoryContextList(contexts), contexts);
}

async function readRepositoryContextHandler({ contextName }: { contextName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const context = await readRepositoryContext(projectPath, contextName);
  if (!context) return err(`Contexto de repositorio no encontrado: ${contextName}`);
  return ok(formatRepositoryContext(context), context);
}

async function createRepositoryContextHandler({
  contextName,
  version,
  purpose,
  description,
}: {
  contextName: string;
  version?: string;
  purpose?: string;
  description?: string;
}) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await createRepositoryContext(projectPath, { name: contextName, version, purpose, description });
    return ok(`Contexto de repositorio creado: ${contextName}`, result);
  } catch (e) {
    return err(`Error creando contexto: ${e}`);
  }
}

async function upsertRepositoryContextParameterHandler({
  contextName,
  parameterName,
  value,
  type,
  prompt,
}: {
  contextName: string;
  parameterName: string;
  value: string;
  type?: string;
  prompt?: string;
}) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    await upsertRepositoryContextParameter(projectPath, contextName, parameterName, value, "Default", type, prompt);
    return ok(`Parámetro '${parameterName}' creado/actualizado en contexto '${contextName}'.`);
  } catch (e) {
    return err(`Error actualizando parámetro: ${e}`);
  }
}

async function deleteRepositoryContextHandler({ contextName }: { contextName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await deleteRepositoryContext(projectPath, contextName);
    return ok(`Contexto de repositorio '${contextName}' eliminado.`);
  } catch (e) {
    return err(`Error eliminando contexto: ${e}`);
  }
}

async function deleteRepositoryContextParameterHandler({
  contextName,
  parameterName,
  context,
}: {
  contextName: string;
  parameterName: string;
  context?: string;
}) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    await deleteRepositoryContextParameter(projectPath, contextName, parameterName, context ?? "Default");
    return ok(`Parámetro '${parameterName}' eliminado del contexto de repositorio '${contextName}'.`);
  } catch (e) {
    return err(`Error eliminando parámetro: ${e}`);
  }
}

async function listAnalyses() {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const analyses = listDQAnalyses(projectPath);
  return okArray(formatDQAnalysesList(analyses), analyses);
}

async function readAnalysis({ analysisName }: { analysisName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");

  const analyses = listDQAnalyses(projectPath);
  const target = analysisName
    ? analyses.find((a) => a.name === analysisName || a.filePath.endsWith(`${analysisName}.ana`))
    : analyses[0];

  if (!target) return err("Análisis no encontrado.");

  const parsed = parseDQAnalysis(target.filePath);
  if (!parsed) return err("No se pudo leer el análisis.");

  return ok(formatDQAnalysis(parsed), parsed);
}

async function updateAnalysisHandler({
  analysisName,
  name,
  status,
  purpose,
  description,
  version,
  author,
  defaultContext,
}: {
  analysisName: string;
  name?: string;
  status?: string;
  purpose?: string;
  description?: string;
  version?: string;
  author?: string;
  defaultContext?: string;
}) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = updateDQAnalysisFiles(projectPath, analysisName, { name, status, purpose, description, version, author, defaultContext });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error actualizando analysis: ${e}`);
  }
}

async function duplicateAnalysisHandler({
  sourceAnalysisName,
  targetAnalysisName,
  version,
  status,
  purpose,
  description,
  author,
  defaultContext,
}: {
  sourceAnalysisName: string;
  targetAnalysisName: string;
  version?: string;
  status?: string;
  purpose?: string;
  description?: string;
  author?: string;
  defaultContext?: string;
}) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = duplicateDQAnalysisFiles(projectPath, sourceAnalysisName, targetAnalysisName, {
      version,
      status,
      purpose,
      description,
      author,
      defaultContext,
    });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error duplicando analysis: ${e}`);
  }
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

async function updateComponentParameter({ jobName, uniqueName, parameterName, value }: { jobName?: string, uniqueName: string, parameterName: string, value: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find(j => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = updateTalendComponentParameterXml(xml, { uniqueName, parameterName, value });
  await writeTextFile(target.itemPath, updatedXml, projectPath);
  return ok(`Propiedad '${parameterName}' actualizada a '${value}' en el componente '${uniqueName}'.`);
}

async function patchComponent({ jobName, uniqueName, patch }: { jobName?: string, uniqueName: string, patch: Record<string, string> }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find(j => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = patchTalendComponentXml(xml, uniqueName, patch);
  await writeTextFile(target.itemPath, updatedXml, projectPath);
  return ok(`Componente '${uniqueName}' actualizado con ${Object.keys(patch).length} cambios.`);
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

async function updateJobMetadata({ propertiesJobName, folderPath, label, description, purpose }: { propertiesJobName?: string; folderPath?: string; label?: string; description?: string; purpose?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = propertiesJobName ? await findTalendJob(projectPath, propertiesJobName, folderPath) : jobs[0];
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

async function deleteComponentHandler({ jobName, uniqueName }: { jobName?: string; uniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = deleteTalendComponentXml(xml, { uniqueName });
  await writeTextFile(target.itemPath, updatedXml, projectPath);
  return ok(JSON.stringify({ itemPath: target.itemPath, uniqueName }, null, 2), { itemPath: target.itemPath, uniqueName });
}

async function previewDeleteComponentHandler({ jobName, uniqueName }: { jobName?: string; uniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendComponentDeletePreview(xml, { uniqueName });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function deleteConnectionHandler({ jobName, uniqueName }: { jobName?: string; uniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = deleteTalendConnectionXml(xml, { uniqueName });
  await writeTextFile(target.itemPath, updatedXml, projectPath);
  return ok(JSON.stringify({ itemPath: target.itemPath, uniqueName }, null, 2), { itemPath: target.itemPath, uniqueName });
}

async function previewDeleteConnectionHandler({ jobName, uniqueName }: { jobName?: string; uniqueName: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const preview = buildTalendConnectionDeletePreview(xml, { uniqueName });
  return ok(JSON.stringify(preview, null, 2), preview);
}

async function moveComponentHandler({ jobName, uniqueName, posX, posY }: { jobName?: string; uniqueName: string; posX: number; posY: number }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");
  const xml = await readTextFile(target.itemPath, projectPath);
  const updatedXml = moveTalendComponentXml(xml, { uniqueName, posX, posY });
  await writeTextFile(target.itemPath, updatedXml, projectPath);
  return ok(JSON.stringify({ itemPath: target.itemPath, uniqueName, posX, posY }, null, 2), { itemPath: target.itemPath, uniqueName, posX, posY });
}

// ──────────────────── Job CRUD handlers ────────────────────

async function createJobHandler({ jobName, version, defaultContext, label, folderPath, description, purpose }: { jobName: string; version?: string; defaultContext?: string; label?: string; folderPath?: string; description?: string; purpose?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await createTalendJob(projectPath, { jobName, version: version ?? "0.1", defaultContext, label, folderPath, description, purpose });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error creando job: ${e}`);
  }
}

async function renameJobHandler({ oldJobName, newJobName, folderPath }: { oldJobName: string; newJobName: string; folderPath?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await renameTalendJob(projectPath, { oldJobName, newJobName, folderPath });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error renombrando job: ${e}`);
  }
}

async function deleteJobHandler({ jobName, folderPath }: { jobName: string; folderPath?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await deleteTalendJob(projectPath, { jobName, folderPath });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error eliminando job: ${e}`);
  }
}

async function duplicateJobHandler({ sourceJobName, sourceFolderPath, targetJobName, targetVersion, targetFolderPath }: { sourceJobName: string; sourceFolderPath?: string; targetJobName: string; targetVersion?: string; targetFolderPath?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await duplicateTalendJob(projectPath, { sourceJobName, sourceFolderPath, targetJobName, targetVersion, targetFolderPath });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error duplicando job: ${e}`);
  }
}

async function moveJobToFolderHandler({ jobName, folderPath }: { jobName: string; folderPath: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  try {
    const result = await moveTalendJobToFolder(projectPath, { jobName, folderPath });
    return ok(JSON.stringify(result, null, 2), result);
  } catch (e) {
    return err(`Error moviendo job: ${e}`);
  }
}

async function generateJobHandler({ spec }: { spec: unknown }) {
  const validation = validateJobSpec(spec);
  if (!validation.valid) {
    return err(`Spec inválido:\n${validation.errors.join("\n")}`);
  }

  const s = spec as JobSpec;
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");

  const { xml: itemXml, rootId } = buildJobItemXml(s);
  const propertiesXml = buildJobPropertiesXml(s, rootId);

  const version = s.version ?? "0.1";
  const itemFileName = `${s.jobName}_${version}.item`;
  const propertiesFileName = `${s.jobName}_${version}.properties`;

  // Resolver carpeta
  const processDir = join(projectPath, "process");
  let targetDir = processDir;
  if (s.folderPath) {
    targetDir = join(processDir, ...s.folderPath.split("/"));
    if (!require("node:fs").existsSync(targetDir)) {
      require("node:fs").mkdirSync(targetDir, { recursive: true });
    }
  }

  const itemPath = join(targetDir, itemFileName);
  const propertiesPath = join(targetDir, propertiesFileName);

  await writeTextFile(itemPath, itemXml, projectPath);
  await writeTextFile(propertiesPath, propertiesXml, projectPath);

  return ok(JSON.stringify({ itemPath, propertiesPath, jobName: s.jobName, version, folderPath: s.folderPath }, null, 2), { 
    itemPath, 
    propertiesPath, 
    jobName: s.jobName, 
    version,
    folderPath: s.folderPath 
  });
}

async function listComponentCatalogHandler() {
  const catalog = Object.values(COMPONENT_REGISTRY).map(c => ({
    name: c.name,
    category: c.category,
    description: c.description
  }));
  return ok(JSON.stringify(catalog, null, 2), catalog);
}

async function getComponentSnippetHandler({ componentName }: { componentName: string }) {
  const snippet = getComponentSnippet(componentName);
  if (!snippet) return err(`Componente '${componentName}' no encontrado en el catálogo.`);
  return ok(JSON.stringify(snippet, null, 2), snippet);
}

import { existsSync } from "node:fs";

function getTalendStudioPath(): string {
  return process.env.TALEND_STUDIO_PATH ?? (() => {
    const macDefault = "/Applications/TalendStudio-8.0.1/studio/plugins";
    if (existsSync(macDefault)) return macDefault;
    const home = process.env.HOME ?? "";
    const homeDefault = `${home}/TalendStudio/plugins`;
    if (existsSync(homeDefault)) return homeDefault;
    return macDefault;
  })();
}

async function discoverComponentsHandler({ pattern }: { pattern?: string }) {
  const pluginsDir = getTalendStudioPath();
  const { execSync } = require("node:child_process");
  
  try {
    // Buscar la carpeta exacta del localprovider (puede cambiar con la versión)
    const providerDir = execSync(`find "${pluginsDir}" -name "org.talend.designer.components.localprovider_*" -type d`).toString().trim();
    const componentsDir = `${providerDir}/components`;
    
    let command = `ls "${componentsDir}"`;
    if (pattern) {
      command += ` | grep -i "${pattern}"`;
    }
    
    const output = execSync(command).toString().trim();
    const components = output.split("\n").filter((c: string) => c && !c.includes("."));
    
    return ok(`Se encontraron ${components.length} componentes que coinciden con '${pattern || "todo"}'.`, components);
  } catch (e) {
    return err(`Error escaneando componentes: ${e}`);
  }
}

async function inspectComponentDefinitionHandler({ componentName }: { componentName: string }) {
  const pluginsDir = getTalendStudioPath();
  const { execSync } = require("node:child_process");
  
  try {
    const providerDir = execSync(`find "${pluginsDir}" -name "org.talend.designer.components.localprovider_*" -type d`).toString().trim();
    const xmlPath = `${providerDir}/components/${componentName}/${componentName}_java.xml`;
    const xmlContent = execSync(`cat "${xmlPath}"`).toString();
    
    return ok(`Estructura XML de '${componentName}' extraída directamente del Studio.`, { xml: xmlContent });
  } catch (e) {
    return err(`No se pudo encontrar la definición de '${componentName}'.`);
  }
}

// ──────────────────── Execution handlers ────────────────────

async function runJobHandler({ jobName, contextName, timeoutMs }: { jobName?: string; contextName?: string; timeoutMs?: number }) {
  const result = await runJob({ jobName, contextName, timeoutMs });
  if (!result.ok) return err(result.error ?? "Job falló");
  return ok(
    `Job completado en ${result.durationMs}ms (exit ${result.exitCode})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    { exitCode: result.exitCode, durationMs: result.durationMs, stdout: result.stdout, stderr: result.stderr },
  );
}

async function jobInfoHandler({ jobName }: { jobName?: string }) {
  const info = await getJobExecutionInfo(jobName);
  if (!info) return err("No se encontró información del job.");
  return ok(JSON.stringify(info, null, 2), info);
}

async function viewLogsHandler({ jobName, maxLines, filter, fromLine }: { jobName?: string; maxLines?: number; filter?: string; fromLine?: number }) {
  const name = jobName ?? (await listJobs(getConfiguredProjectPath() ?? ""))[0]?.label ?? "";
  if (!name) return err("No se detectó job.");

  const result = readLogContent(findJobLogFile(name)?.path ?? "", { maxLines, filter, fromLine });
  if (!result.lines.length) return err("No se encontró archivo de log.");

  const formatted = formatLogLines(result.lines, true);
  const truncatedNote = result.truncated ? `\n\n[ truncado: mostrando últimas ${result.lines.length} de ${result.totalLines} líneas ]` : "";
  return ok(`${formatted}${truncatedNote}`, { totalLines: result.totalLines, returnedLines: result.lines.length, truncated: result.truncated });
}

async function analyzeLogsHandler({ jobName }: { jobName?: string }) {
  const name = jobName ?? (await listJobs(getConfiguredProjectPath() ?? ""))[0]?.label ?? "";
  if (!name) return err("No se detectó job.");

  const analysis = analyzeJobLogs(name);
  if (!analysis.logFile) return err(`No se encontró archivo de log para "${name}".\n\nSugerencias:\n${analysis.suggestions.join("\n")}`);

  const status = analysis.analysis?.status ?? "unknown";
  const statusEmoji = status === "error" ? " ERROR " : status === "success" ? " OK " : " ? ";
  const statusColor = status === "error" ? "❌" : status === "success" ? "✅" : "❓";

  let output = `${statusColor} Job: ${name} | Status: ${status}\n`;
  output += `Log: ${analysis.logFile.path}\n`;
  output += `Tamaño: ${(analysis.logFile.size / 1024).toFixed(1)} KB\n`;
  output += `Modificado: ${analysis.logFile.modified.toISOString()}\n`;
  output += `Errores encontrados: ${analysis.analysis?.errors?.length ?? 0}\n\n`;

  if (analysis.analysis?.errors?.length) {
    output += `=== ERRORES ===\n`;
    for (const err of analysis.analysis.errors) {
      output += `Línea ${err.line}: ${err.message.split("\n")[0]}\n`;
    }
    output += "\n";
  }

  if (analysis.suggestions.length) {
    output += `=== SUGERENCIAS ===\n${analysis.suggestions.join("\n")}\n\n`;
  }

  if (analysis.rawSnippet.length) {
    output += `=== CONTEXTO RECIENTE ===\n${formatLogLines(analysis.rawSnippet, true)}`;
  }

  return ok(output, analysis);
}

async function fullAnalysisHandler({ jobName }: { jobName?: string }) {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return err("No se detectó TALEND_PROJECT.");
  const jobs = await listJobs(projectPath);
  const target = jobName ? jobs.find((j) => j.label === jobName) : jobs[0];
  if (!target) return err("Job no encontrado.");

  const xml = await readTextFile(target.itemPath, projectPath);
  const job = parseJobItem(xml, target.itemPath);
  const analysis = analyzeJob(job);
  const formatted = formatAnalysis(analysis);
  return ok(formatted, analysis);
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
    inputSchema: z.object({ jobName: z.string().optional(), folderPath: z.string().optional() }),
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
    name: "talend_list_project_contexts",
    description: "Lista todos los contextos de todos los jobs del proyecto abierto.",
    inputSchema: z.object({}),
    handler: listProjectContextsHandler,
  },
  {
    name: "talend_list_analyses",
    description: "Lista los análisis de Data Profiling del proyecto abierto.",
    inputSchema: z.object({}),
    handler: listAnalyses,
  },
  {
    name: "talend_read_analysis",
    description: "Lee el contenido de un análisis de Data Profiling.",
    inputSchema: z.object({ analysisName: z.string().optional().describe("Nombre del análisis") }),
    handler: readAnalysis,
  },
  {
    name: "talend_update_analysis",
    description: "Actualiza metadata de un análisis de Data Profiling.",
    inputSchema: z.object({
      analysisName: z.string().describe("Nombre del análisis a actualizar"),
      name: z.string().optional().describe("Nuevo nombre interno"),
      status: z.string().optional().describe("Nuevo status"),
      purpose: z.string().optional().describe("Nuevo propósito"),
      description: z.string().optional().describe("Nueva descripción"),
      version: z.string().optional().describe("Nueva versión"),
      author: z.string().optional().describe("Nuevo autor"),
      defaultContext: z.string().optional().describe("Nuevo contexto por defecto"),
    }),
    handler: updateAnalysisHandler,
  },
  {
    name: "talend_duplicate_analysis",
    description: "Duplica un análisis de Data Profiling con nuevo nombre.",
    inputSchema: z.object({
      sourceAnalysisName: z.string().describe("Nombre del análisis origen"),
      targetAnalysisName: z.string().describe("Nombre del análisis duplicado"),
      version: z.string().optional().describe("Versión del duplicado (default: misma que origen)"),
      status: z.string().optional().describe("Status a aplicar"),
      purpose: z.string().optional().describe("Propósito a aplicar"),
      description: z.string().optional().describe("Descripción a aplicar"),
      author: z.string().optional().describe("Autor a aplicar"),
      defaultContext: z.string().optional().describe("Contexto por defecto a aplicar"),
    }),
    handler: duplicateAnalysisHandler,
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
    name: "talend_view_logs",
    description: "Muestra líneas de log de un job con números de línea y marcadores de error. Soporta filtrado y paginación.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job (default: primero encontrado)"),
      maxLines: z.number().optional().describe("Máximo de líneas a devolver (default: 100)"),
      filter: z.string().optional().describe("Filtro de texto a buscar en las líneas"),
      fromLine: z.number().optional().describe("Inicio de lectura (default: 1)"),
    }),
    handler: viewLogsHandler,
  },
  {
    name: "talend_analyze_logs",
    description: "Analiza logs de un job: detecta status, errores, sugiere acciones y muestra snippet de contexto.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job (default: primero encontrado)"),
    }),
    handler: analyzeLogsHandler,
  },
  {
    name: "talend_full_analysis",
    description: "Análisis completo de un job: componentes, conexiones, contexts, tDBOutput, schema issues y warnings. Formato legible.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job (default: primero encontrado)"),
    }),
    handler: fullAnalysisHandler,
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
    name: "talend_patch_component",
    description: "Actualiza múltiples propiedades de un componente de un solo golpe (patch).",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job"),
      uniqueName: z.string().describe("UNIQUE_NAME del componente (ej: tMysqlOutput_1)"),
      patch: z.record(z.string(), z.string()).describe("Mapa de propiedades y nuevos valores"),
    }),
    handler: patchComponent,
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
      folderPath: z.string().optional(),
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
  // ─── Repository Context tools ───
  {
    name: "talend_list_repository_contexts",
    description: "Lista todos los contextos de repositorio del proyecto.",
    inputSchema: z.object({}),
    handler: listRepositoryContextsHandler,
  },
  {
    name: "talend_read_repository_context",
    description: "Lee un contexto de repositorio completo con todas sus variables.",
    inputSchema: z.object({
      contextName: z.string().describe("Nombre del contexto de repositorio (ej: olist_context)"),
    }),
    handler: readRepositoryContextHandler,
  },
  {
    name: "talend_create_repository_context",
    description: "Crea un nuevo contexto de repositorio en la carpeta context/.",
    inputSchema: z.object({
      contextName: z.string().describe("Nombre del contexto"),
      version: z.string().optional().describe("Versión (default: 0.1)"),
      purpose: z.string().optional().describe("Propósito del contexto"),
      description: z.string().optional().describe("Descripción del contexto"),
    }),
    handler: createRepositoryContextHandler,
  },
  {
    name: "talend_upsert_repository_context_parameter",
    description: "Crea o actualiza un parámetro dentro de un contexto de repositorio.",
    inputSchema: z.object({
      contextName: z.string().describe("Nombre del contexto de repositorio"),
      parameterName: z.string().describe("Nombre del parámetro"),
      value: z.string().describe("Valor del parámetro"),
      type: z.string().optional().describe("Tipo (ej: id_String, id_Password)"),
      prompt: z.string().optional().describe("Prompt mostrado al usuario"),
    }),
    handler: upsertRepositoryContextParameterHandler,
  },
  {
    name: "talend_delete_repository_context",
    description: "Elimina un contexto de repositorio completo (archivos .item y .properties).",
    inputSchema: z.object({
      contextName: z.string().describe("Nombre del contexto a eliminar"),
    }),
    handler: deleteRepositoryContextHandler,
  },
  {
    name: "talend_delete_repository_context_parameter",
    description: "Elimina un parámetro específico de un contexto de repositorio.",
    inputSchema: z.object({
      contextName: z.string().describe("Nombre del contexto de repositorio"),
      parameterName: z.string().describe("Nombre del parámetro a borrar"),
      context: z.string().optional().describe("Nombre del bloque de contexto (default: Default)"),
    }),
    handler: deleteRepositoryContextParameterHandler,
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
  // ─── Execution tools ───
  {
    name: "talend_run_job",
    description: "Ejecuta un job de Talend Studio y devuelve stdout, stderr, exitCode y duración.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job a ejecutar (default: primero encontrado)"),
      contextName: z.string().optional().describe("Nombre del contexto (default: Default)"),
      timeoutMs: z.number().optional().describe("Timeout en milisegundos (default: 300000)"),
    }),
    handler: runJobHandler,
  },
  {
    name: "talend_job_info",
    description: "Devuelve información del script de ejecución de un job: itemPath, propertiesPath y scriptPath.",
    inputSchema: z.object({
      jobName: z.string().optional().describe("Nombre del job (default: primero encontrado)"),
    }),
    handler: jobInfoHandler,
  },
  // ─── Job CRUD tools ───
  {
    name: "talend_create_job",
    description: "Crea un job nuevo vacío en el proyecto.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job"),
      version: z.string().optional().describe("Versión (default: 0.1)"),
      defaultContext: z.string().optional().describe("Contexto por defecto (default: Default)"),
      label: z.string().optional().describe("Etiqueta visible"),
      description: z.string().optional().describe("Descripción inicial"),
      purpose: z.string().optional().describe("Propósito inicial"),
      folderPath: z.string().optional().describe("Carpeta destino dentro de process"),
    }),
    handler: createJobHandler,
  },
  {
    name: "talend_create_folder",
    description: "Crea una carpeta dentro de process para organizar jobs.",
    inputSchema: z.object({
      folderPath: z.string().describe("Ruta de carpeta dentro de process, por ejemplo carpeta_a/subcarpeta_b"),
    }),
    handler: createFolderHandler,
  },
  {
    name: "talend_rename_job",
    description: "Renombra un job existente.",
    inputSchema: z.object({
      oldJobName: z.string().describe("Nombre actual del job"),
      newJobName: z.string().describe("Nuevo nombre del job"),
      folderPath: z.string().optional().describe("Carpeta del job origen"),
    }),
    handler: renameJobHandler,
  },
  {
    name: "talend_delete_job",
    description: "Elimina un job existente (item + properties).",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job a eliminar"),
      folderPath: z.string().optional().describe("Carpeta del job"),
    }),
    handler: deleteJobHandler,
  },
  {
    name: "talend_duplicate_job",
    description: "Duplica un job existente con un nombre nuevo.",
    inputSchema: z.object({
      sourceJobName: z.string().describe("Nombre del job origen"),
      sourceFolderPath: z.string().optional().describe("Carpeta del job origen"),
      targetJobName: z.string().describe("Nombre del job duplicado"),
      targetVersion: z.string().optional().describe("Versión del duplicado (default: misma que origen)"),
      targetFolderPath: z.string().optional().describe("Carpeta destino del duplicado"),
    }),
    handler: duplicateJobHandler,
  },
  {
    name: "talend_move_job_to_folder",
    description: "Mueve un job existente a otra carpeta dentro de process.",
    inputSchema: z.object({
      jobName: z.string().describe("Nombre del job a mover"),
      folderPath: z.string().describe("Carpeta destino dentro de process"),
    }),
    handler: moveJobToFolderHandler,
  },
  // ─── Flow editing tools ───
  {
    name: "talend_delete_component",
    description: "Elimina un componente del job y sus conexiones.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
    }),
    handler: deleteComponentHandler,
  },
  {
    name: "talend_preview_delete_component",
    description: "Muestra preview y diff al eliminar un componente.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
    }),
    handler: previewDeleteComponentHandler,
  },
  {
    name: "talend_delete_connection",
    description: "Elimina una conexión del job.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string().describe("UNIQUE_NAME de la conexión"),
    }),
    handler: deleteConnectionHandler,
  },
  {
    name: "talend_preview_delete_connection",
    description: "Muestra preview y diff al eliminar una conexión.",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string().describe("UNIQUE_NAME de la conexión"),
    }),
    handler: previewDeleteConnectionHandler,
  },
  {
    name: "talend_move_component",
    description: "Mueve un componente a una nueva posición (posX, posY).",
    inputSchema: z.object({
      jobName: z.string().optional(),
      uniqueName: z.string().describe("UNIQUE_NAME del componente"),
      posX: z.number().describe("Nueva posición X"),
      posY: z.number().describe("Nueva posición Y"),
    }),
    handler: moveComponentHandler,
  },
  // ─── Job generation tool ───
  {
    name: "talend_generate_job",
    description: "Genera un job completo desde una especificación declarativa (JobSpec). Valida el spec, construye el .item y el .properties, y los escribe en el proyecto.",
    inputSchema: z.object({
      spec: z.object({
        jobName: z.string().describe("Nombre del job"),
        version: z.string().optional().describe("Versión (default: 0.1)"),
        defaultContext: z.string().optional().describe("Contexto por defecto (default: Default)"),
        label: z.string().optional().describe("Etiqueta visible"),
        description: z.string().optional().describe("Descripción del job"),
        purpose: z.string().optional().describe("Propósito del job"),
        folderPath: z.string().optional().describe("Carpeta donde se guardará el job"),
        components: z.array(z.object({
          uniqueName: z.string().describe("UNIQUE_NAME del componente"),
          componentName: z.string().describe("Nombre del componente (ej: tFileInputDelimited, tMap, tMysqlOutput)"),
          posX: z.number().optional().describe("Posición X"),
          posY: z.number().optional().describe("Posición Y"),
          label: z.string().optional().describe("Etiqueta del componente"),
          parameters: z.record(z.string(), z.string()).optional().describe("Parámetros adicionales"),
          schema: z.object({
            name: z.string().describe("Nombre del schema"),
            connector: z.string().optional().describe("Connector (default: FLOW)"),
            columns: z.array(z.object({
              name: z.string().describe("Nombre de la columna"),
              type: z.string().optional().describe("Tipo (default: id_String)"),
              length: z.number().optional().describe("Longitud"),
              precision: z.number().optional().describe("Precisión"),
              nullable: z.boolean().optional().describe("Nullable"),
              key: z.boolean().optional().describe("Es clave"),
              sourceType: z.string().optional().describe("Tipo en fuente"),
              pattern: z.string().optional().describe("Patrón"),
            })).optional().describe("Columnas del schema"),
          }).optional().describe("Schema del componente"),
        })).describe("Componentes del job"),
        connections: z.array(z.object({
          source: z.string().describe("UNIQUE_NAME del componente fuente"),
          target: z.string().describe("UNIQUE_NAME del componente destino"),
          label: z.string().describe("Etiqueta de la conexión"),
          connectorName: z.string().optional().describe("Tipo de connector (default: FLOW)"),
          metaname: z.string().optional().describe("Nombre del meta"),
          uniqueName: z.string().optional().describe("UNIQUE_NAME de la conexión"),
        })).optional().describe("Conexiones entre componentes"),
      }),
    }),
    handler: generateJobHandler,
  },
  {
    name: "talend_list_component_catalog",
    description: "Muestra el catálogo de componentes de Talend soportados con sus descripciones y categorías.",
    inputSchema: z.object({}),
    handler: listComponentCatalogHandler,
  },
  {
    name: "talend_get_component_snippet",
    description: "Devuelve un fragmento de JSON (JobSpec snippet) para un componente específico, incluyendo sus parámetros por defecto.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente (ej: tMysqlOutput, tMap)"),
    }),
    handler: getComponentSnippetHandler,
  },
  {
    name: "talend_discover_components",
    description: "Escanea dinámicamente los plugins de Talend Studio para descubrir nuevos componentes por nombre o patrón.",
    inputSchema: z.object({
      pattern: z.string().optional().describe("Patrón de búsqueda (ej: 'S3', 'Google', 'BigData')"),
    }),
    handler: discoverComponentsHandler,
  },
  {
    name: "talend_inspect_component_definition",
    description: "Lee el XML original de un componente desde los plugins de Talend para conocer sus parámetros técnicos reales.",
    inputSchema: z.object({
      componentName: z.string().describe("Nombre del componente (ej: tSystem, tSSH)"),
    }),
    handler: inspectComponentDefinitionHandler,
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

  function getToolAnnotations(name: string) {
    const writeTools = new Set([
      "talend_update_component_parameter",
      "talend_patch_component",
      "talend_update_schema_column",
      "talend_duplicate_component",
      "talend_add_connection",
      "talend_update_context",
      "talend_upsert_context",
      "talend_delete_context",
      "talend_update_job_metadata",
      "talend_update_analysis",
      "talend_duplicate_analysis",
      "talend_delete_component",
      "talend_delete_connection",
      "talend_move_component",
      "talend_create_job",
      "talend_create_folder",
      "talend_rename_job",
      "talend_delete_job",
      "talend_duplicate_job",
      "talend_move_job_to_folder",
      "talend_run_exported_job",
      "talend_bridge_execute_command",
      "talend_bridge_run_launch_config",
      "talend_bridge_open_resource",
      "talend_bridge_save_active_editor",
      "talend_bridge_save_all",
      "talend_bridge_refresh_workspace",
      "talend_auto_run_active_job",
      "talend_safe_edit_component_parameter",
      "talend_safe_patch_component",
      "talend_safe_add_connection",
      "talend_create_repository_context",
      "talend_upsert_repository_context_parameter",
      "talend_delete_repository_context",
      "talend_delete_repository_context_parameter",
    ]);
    return {
      readOnlyHint: !writeTools.has(name),
      idempotentHint: !writeTools.has(name),
    };
  }

  const writeTools = new Set([
    "talend_update_component_parameter",
    "talend_patch_component",
    "talend_update_schema_column",
    "talend_duplicate_component",
    "talend_add_connection",
    "talend_update_context",
    "talend_upsert_context",
    "talend_update_job_metadata",
    "talend_update_analysis",
    "talend_duplicate_analysis",
    "talend_delete_component",
    "talend_delete_connection",
    "talend_move_component",
    "talend_create_job",
    "talend_create_folder",
    "talend_rename_job",
    "talend_delete_job",
    "talend_duplicate_job",
    "talend_move_job_to_folder",
    "talend_create_repository_context",
    "talend_upsert_repository_context_parameter",
    "talend_delete_repository_context",
    "talend_delete_repository_context_parameter",
  ]);

  const workspaceTools = new Set([
    "talend_detect_open_job",
    "talend_read_latest_run_log",
    "talend_read_job_errors",
    "talend_summarize_open_job",
    "talend_view_logs",
    "talend_analyze_logs",
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

  const allToolDefs = [...toolDefs, ...createStudioBridgeTools(), ...studioToolDefs];

  for (const tool of allToolDefs) {
    let handler = wrapGuard(tool.name, tool.handler);

    if (liveWriter) {
      handler = wrapHandler(tool.name, handler, liveWriter);
    }

    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: getToolAnnotations(tool.name),
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
