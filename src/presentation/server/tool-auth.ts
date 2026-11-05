import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { getTalendMcpEnv } from "../../config/env";
import { getToolRisk, type ToolRisk } from "./tool-safety";

function envFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "1" || value === "true";
}

export function isRiskAllowed(risk: ToolRisk): boolean {
  const env = getTalendMcpEnv();
  if (risk === "read") return true;
  if (risk === "write") return envFlag(env.TALEND_MCP_ALLOW_WRITE) !== false;
  if (risk === "execute") return envFlag(env.TALEND_MCP_ALLOW_EXECUTE) !== false;
  return envFlag(env.TALEND_MCP_ALLOW_DESTRUCTIVE) === true;
}

export function auditToolCall(toolName: string, risk: ToolRisk, ok: boolean, detail?: string): void {
  const env = getTalendMcpEnv();
  if (env.TALEND_MCP_LOG === "quiet") return;
  const entry = {
    ts: new Date().toISOString(),
    tool: toolName,
    risk,
    ok,
    ...(detail ? { detail } : {}),
  };
  try {
    const dir = join(process.cwd(), ".talend-mcp");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "audit.jsonl"), JSON.stringify(entry) + "\n", "utf8");
  } catch {
  }
}

export function authorizeTool(toolName: string, input: unknown): { ok: true } | { ok: false; code: string; message: string } {
  const risk = getToolRisk(toolName);
  if (!isRiskAllowed(risk)) {
    auditToolCall(toolName, risk, false, "RISK_NOT_ALLOWED");
    return {
      ok: false,
      code: "RISK_NOT_ALLOWED",
      message: `La tool ${toolName} requiere riesgo ${risk} y no esta permitido (TALEND_MCP_ALLOW_*).`,
    };
  }
  if (risk === "destructive") {
    const confirm = (input as Record<string, unknown> | null | undefined)?.confirm;
    if (confirm !== true) {
      auditToolCall(toolName, risk, false, "CONFIRMATION_REQUIRED");
      return {
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        message: `La tool ${toolName} es destructiva y requiere confirm: true.`,
      };
    }
  }
  return { ok: true };
}
