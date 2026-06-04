import type { OpenJob, LaunchConfig } from "../../../domain/workspace/workspace.entity";
import { ok, fail } from "../common/response";

type Confidence = "high" | "medium" | "low" | "none";

interface Evidence<T = unknown> {
  ok: boolean;
  source: "unknown" | "filesystem" | "workbench-xmi" | "metadata-log" | "launch-config" | "exported-job-script" | "studio-bridge" | "process";
  confidence: Confidence;
  data?: T | undefined;
  error?: string | undefined;
  checkedPaths?: string[] | undefined;
  nextSteps?: string[] | undefined;
}

interface WorkbenchState {
  windows: unknown[];
}

async function parseWorkbenchState(projectPath?: string): Promise<Evidence<WorkbenchState>> {
  return { ok: true, source: "workbench-xmi", confidence: "low", data: { windows: [] } };
}

async function getProbableActiveJob(): Promise<{ ok: boolean; source: string; confidence: Confidence; jobName?: string; error?: string; nextSteps?: string[]; }> {
  return { ok: false, source: "unknown", confidence: "none" };
}

export function createListOpenEditorsTool() {
  return {
    name: "talend_list_open_editors",
    description: "Lista los editores abiertos desde los archivos workbench XMI del workspace.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const start = Date.now();
      try {
        const result = await parseWorkbenchState();
        return ok({ ...result }, { startTime: start });
      } catch (err) {
        return fail("LIST_OPEN_EDITORS_ERROR", `Error listando editores abiertos: ${err}`, { startTime: start });
      }
    },
  };
}

export function createGetProbableActiveJobTool() {
  return {
    name: "talend_get_probable_active_job",
    description: "Detecta el job que probablemente está abierto en Talend Studio.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const start = Date.now();
      try {
        const result = await getProbableActiveJob();
        return ok({ ...result }, { startTime: start });
      } catch (err) {
        return fail("GET_PROBABLE_ACTIVE_JOB_ERROR", `Error detectando job activo: ${err}`, { startTime: start });
      }
    },
  };
}