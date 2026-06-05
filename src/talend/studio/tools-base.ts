import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { readTextFile, listFilesRecursive } from "../files";
import { parseOpenJobsFromWorkbench } from "../open-job";
import { getConfiguredProjectPath, resolveWorkspaceFromProject } from "../workspace";
import { TalendStudioBridgeClient } from "./bridge-client";
import type { BridgeConfidence } from "./bridge-client";

export type BridgeToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (input: any) => Promise<CallToolResult>;
};

export type ToolEnvelope = {
  ok: boolean;
  source: string;
  confidence: BridgeConfidence;
  endpoint: string;
  data?: unknown;
  warning?: string;
  limitations?: string[];
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

export function bridgeOk(payload: ToolEnvelope): CallToolResult {
  const structuredContent = payload as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function bridgeFail(payload: ToolEnvelope): CallToolResult {
  const structuredContent = payload as Record<string, unknown>;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function isBridgeOutdated(error: { code?: string; message?: string; status?: number } | undefined | null): boolean {
  if (!error) return false;
  return (
    error.message?.includes("404") ||
    error.status === 404 ||
    error.code === "ENDPOINT_NOT_FOUND" ||
    error.code === "HTTP_404"
  );
}

let bridgeOutdatedFlag = false;

export function getBridgeOutdatedState(): boolean {
  return bridgeOutdatedFlag;
}

export function setBridgeOutdatedState(outdated: boolean): void {
  bridgeOutdatedFlag = outdated;
}

export function bridgeResultToEnvelope<T>(result: { ok: boolean; source: string; confidence: BridgeConfidence; data?: T; error?: { code: string; message: string }; status?: number }, endpoint: string): ToolEnvelope {
  if (result.ok) {
    return {
      ok: true,
      source: result.source,
      confidence: result.confidence,
      endpoint,
      data: result.data,
    };
  }

  const outdated = isBridgeOutdated(result.error);
  if (outdated) {
    setBridgeOutdatedState(true);
  }

  return {
    ok: false,
    source: result.source,
    confidence: result.confidence,
    endpoint,
    error: result.error,
    warning: result.error?.message,
    limitations: outdated ? ["Bridge plugin is outdated. Please reinstall the Talend Studio bridge plugin to access this endpoint."] : undefined,
  };
}

export function buildUnavailableEnvelope(endpoint: string, warning: string, data?: unknown): ToolEnvelope {
  return {
    ok: true,
    source: "workspace-files",
    confidence: "low",
    endpoint,
    warning,
    data,
  };
}

export async function loadBridge(): Promise<TalendStudioBridgeClient> {
  return await TalendStudioBridgeClient.create();
}

export async function readOpenJobFallback(): Promise<{ job?: Record<string, unknown>; summary?: Record<string, unknown> }> {
  const projectPath = getConfiguredProjectPath();
  if (!projectPath) return {};

  const workspace = resolveWorkspaceFromProject(projectPath);
  const workbenchDir = join(workspace.metadataPath, ".plugins", "org.eclipse.e4.workbench");
  const xmiFiles = await listFilesRecursive(workbenchDir, (ruta) => ruta.endsWith(".xmi"));

  const openJobs: Array<{ jobName: string; version: string; label: string; workbenchPath: string; selected: boolean }> = [];
  for (const xmiPath of xmiFiles) {
    try {
      const content = await readTextFile(xmiPath, projectPath);
      const jobs = parseOpenJobsFromWorkbench(content, xmiPath);
      openJobs.push(...jobs);
    } catch { /* skip */ }
  }

  const selected = openJobs.find((j) => j.selected);
  if (!selected && openJobs.length > 0) {
    return { job: { name: openJobs[0]!.jobName, version: openJobs[0]!.version }, summary: { count: openJobs.length } };
  }
  if (selected) {
    return { job: { name: selected.jobName, version: selected.version }, summary: { count: openJobs.length } };
  }
  return {};
}

export function getWorkspacePath(projectPath: string): string {
  return join(projectPath, "workspace");
}