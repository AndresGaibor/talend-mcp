import { join } from "node:path";
import { homedir } from "node:os";
import type { StudioBridgeClient, BridgeCapability } from "../../domain/studio/bridge.entity";
import type { OpenJob, LaunchConfig } from "../../domain/workspace/workspace.entity";

export type BridgeSource = "studio-bridge" | "workspace-files" | "unavailable";

export type BridgeConfidence = "high" | "medium" | "low";

export type BridgeConfig = {
  host: string;
  port: number;
  readOnly: boolean;
  unsafeActions: boolean;
  allowAllCommands: boolean;
  allowCommands: string[];
  timeoutMs: number;
};

export type BridgeError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type BridgeResult<T> = {
  ok: boolean;
  source: BridgeSource;
  confidence: BridgeConfidence;
  endpoint: string;
  status?: number;
  data?: T;
  error?: BridgeError;
  rawText?: string;
};

type BridgeRequestInit = {
  method?: "GET" | "POST";
  body?: unknown;
  allowUnauthenticated?: boolean;
};

const DEFAULT_CONFIG: BridgeConfig = {
  host: "127.0.0.1",
  port: 3930,
  readOnly: true,
  unsafeActions: false,
  allowAllCommands: false,
  allowCommands: ["org.eclipse.ui.file.save", "org.eclipse.ui.file.saveAll"],
  timeoutMs: 2_500,
};

function getHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? ".";
}

function expandHomePath(ruta: string): string {
  if (!ruta.startsWith("~")) return ruta;
  return join(getHomeDir(), ruta.slice(1).replace(/^[\\/]/, ""));
}

async function readJsonFile<T>(rutaArchivo: string): Promise<T | undefined> {
  try {
    const texto = await Bun.file(rutaArchivo).text();
    return JSON.parse(texto) as T;
  } catch {
    return undefined;
  }
}

export async function readTalendStudioBridgeConfig(): Promise<BridgeConfig> {
  const configPath = expandHomePath(process.env.TALEND_BRIDGE_CONFIG ?? "~/.talend-bridge/config.json");
  const parsed = await readJsonFile<Partial<BridgeConfig>>(configPath);

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    allowCommands: parsed?.allowCommands?.length ? parsed.allowCommands : DEFAULT_CONFIG.allowCommands,
    allowAllCommands: parsed?.allowAllCommands ?? DEFAULT_CONFIG.allowAllCommands,
  };
}

export async function readTalendStudioBridgeToken(): Promise<string | undefined> {
  const tokenPath = expandHomePath(process.env.TALEND_BRIDGE_TOKEN ?? "~/.talend-bridge/token");
  try {
    const token = await Bun.file(tokenPath).text();
    const normalized = token?.trim();
    return normalized ? normalized : undefined;
  } catch {
    return undefined;
  }
}

export class TalendStudioBridgeClient implements StudioBridgeClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly config: BridgeConfig;

  constructor(config: BridgeConfig, token?: string) {
    this.baseUrl = `http://${config.host}:${config.port}`;
    this.token = token;
    this.timeoutMs = config.timeoutMs;
    this.config = config;
  }

  static async create(options?: { config?: Partial<BridgeConfig>; token?: string }): Promise<TalendStudioBridgeClient> {
    const config = {
      ...(await readTalendStudioBridgeConfig()),
      ...(options?.config ?? {}),
    };
    return new TalendStudioBridgeClient(config, options?.token ?? (await readTalendStudioBridgeToken()));
  }

  async ping(): Promise<boolean> {
    const result = await this.request<{ ok: true; plugin: string; version: string; mode: string }>("/ping", {
      allowUnauthenticated: true,
    });
    return result.ok;
  }

  async getCapabilities(): Promise<BridgeCapability[]> {
    type CapsResponse = { ok: true; capabilities?: Record<string, unknown> };
    const result = await this.request<CapsResponse>("/capabilities");
    if (!result.ok || !result.data?.capabilities) return [];
    return this.mapCapabilities(result.data.capabilities);
  }

  private mapCapabilities(caps: Record<string, unknown>): BridgeCapability[] {
    const capabilities: BridgeCapability[] = [];
    if (caps.ping !== undefined) capabilities.push("ping");
    if (caps.capabilities !== undefined) capabilities.push("capabilities");
    if (caps.audit !== undefined) capabilities.push("audit");
    if (caps.workbench !== undefined) capabilities.push("workbench");
    if (caps.active_job !== undefined) capabilities.push("active_job");
    if (caps.commands !== undefined) capabilities.push("commands");
    if (caps.launch_configs !== undefined) capabilities.push("launch_configs");
    if (caps.problems !== undefined) capabilities.push("problems");
    if (caps.open_jobs !== undefined) capabilities.push("open_jobs");
    return capabilities;
  }

  async executeCommand(command: { name: string; args?: Record<string, string> }): Promise<unknown> {
    const result = await this.request<Record<string, unknown>>("/commands/execute", {
      method: "POST",
      body: { commandId: command.name, args: command.args },
    });
    return result.data ?? result.error;
  }

  async getLaunchConfigs(): Promise<LaunchConfig[]> {
    type LaunchConfigsResponse = { ok: true; configs?: Array<{ name?: string; type?: string; path?: string }> };
    const result = await this.request<LaunchConfigsResponse>("/launch/configs");
    if (!result.ok || !result.data?.configs) return [];
    return result.data.configs.map((c) => ({
      path: c.path ?? "",
      name: c.name ?? "",
    }));
  }

  async getOpenJobs(): Promise<OpenJob[]> {
    type WorkbenchResponse = { windows?: Array<Record<string, unknown>> };
    const result = await this.request<WorkbenchResponse>("/workbench/state");
    if (!result.ok || !result.data?.windows) return [];
    const jobs: OpenJob[] = [];
    for (const window of result.data.windows) {
      if (typeof window.label === "string" && window.label.startsWith("Job ")) {
        const match = /^Job\s+(.+)\s+(\d+(?:\.\d+)*)$/.exec(window.label);
        if (match) {
          const jobName = match[1];
          const version = match[2];
          if (!jobName || !version) continue;
          jobs.push({
            jobName,
            version,
            label: window.label,
            workbenchPath: "",
            selected: true,
          });
        }
      }
    }
    return jobs;
  }

  async auditEnvironment(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/audit/environment");
  }

  async workbenchState(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/state");
  }

  async selection(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/selection");
  }

  async views(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/views");
  }

  async activeJobModel(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/active-job/model");
  }

  async commandsList(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/commands/list");
  }

  async executeCommandRaw(commandId: string, dryRun: boolean): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/commands/execute", {
      method: "POST",
      body: { commandId, dryRun },
    });
  }

  async runLaunchConfig(name: string, dryRun: boolean, mode = "run"): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/run", {
      method: "POST",
      body: { name, mode, dryRun },
    });
  }

  async launchRuns(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/runs");
  }

  async launchRunStatus(launchId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/run-status", {
      method: "POST",
      body: { launchId },
    });
  }

  async launchWait(launchId: string, timeoutMs = 60000): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/launch/wait", {
      method: "POST",
      body: { launchId, timeoutMs },
    });
  }

  async openResource(path: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/open-resource", {
      method: "POST",
      body: { path },
    });
  }

  async workspaceState(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workspace/state");
  }

  async problemsMarkers(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/problems/markers");
  }

  async probeClasses(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/probe/classes");
  }

  async activeEditorIntrospect(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/active-editor/introspect");
  }

  async eventsRecent(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/events/recent");
  }

  async eventsClear(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/events/clear");
  }

  async saveActiveEditor(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/save-active");
  }

  async saveAllEditors(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/save-all");
  }

  async findEditor(titleContains: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>(
      "/workbench/find-editor?titleContains=" + encodeURIComponent(titleContains)
    );
  }

  async activateEditor(title: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/activate-editor", {
      method: "POST",
      body: { title },
    });
  }

  async closeEditor(title: string, save = true): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/close-editor", {
      method: "POST",
      body: { title, save },
    });
  }

  async showView(viewId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/show-view", {
      method: "POST",
      body: { viewId },
    });
  }

  async refreshWorkspace(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workspace/refresh");
  }

  async runActiveJob(options: {
    dryRun?: boolean;
    saveBefore?: boolean;
    waitForTermination?: boolean;
    timeoutMs?: number;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/run-active-job", {
      method: "POST",
      body: options,
    });
  }

  private async request<T>(endpoint: string, init: BridgeRequestInit = {}): Promise<BridgeResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (this.token && init.allowUnauthenticated !== true) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: init.method ?? "GET",
        headers,
        signal: controller.signal,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

      const rawText = await response.text();
      const parsed = rawText.length > 0 ? this.safeParseJson<T>(rawText) : undefined;

      if (!response.ok) {
        return {
          ok: false,
          source: "unavailable",
          confidence: "low",
          endpoint,
          status: response.status,
          rawText,
          error: {
            code: `HTTP_${response.status}`,
            message: this.extractMessage(parsed, rawText, response.statusText),
          },
        };
      }

      return {
        ok: true,
        source: "studio-bridge",
        confidence: "high",
        endpoint,
        status: response.status,
        data: (parsed ?? (rawText.length > 0 ? ({ rawText } as T) : undefined)) as T,
        rawText,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        source: "unavailable",
        confidence: "low",
        endpoint,
        error: { code: "BRIDGE_UNAVAILABLE", message: mensaje },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private safeParseJson<T>(value: string): T | undefined {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private extractMessage(parsed: unknown, rawText: string, fallback: string): string {
    if (parsed && typeof parsed === "object") {
      const maybeError = parsed as { error?: { message?: unknown } };
      if (typeof maybeError.error?.message === "string") {
        return maybeError.error.message;
      }
    }
    return rawText || fallback;
  }

  getConfig(): BridgeConfig {
    return this.config;
  }
}
