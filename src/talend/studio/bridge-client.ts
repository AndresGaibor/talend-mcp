import { join } from "node:path";

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

export type BridgePingPayload = {
  ok: true;
  plugin: string;
  version: string;
  mode: string;
};

export type BridgeCommand = {
  id: string;
  name?: string;
  defined?: boolean;
  enabled?: boolean;
  category?: string;
};

export type BridgeLaunchConfig = {
  name?: string;
  type?: string;
  path?: string;
  attributes?: Record<string, string>;
};

export type BridgeWorkbenchState = {
  windows?: Array<Record<string, unknown>>;
  source?: string;
  confidence?: BridgeConfidence;
};

export type BridgeCapabilities = {
  ok: true;
  capabilities?: Record<string, unknown>;
  limitations?: string[];
};

export type BridgeEnvironment = {
  ok: true;
  java?: Record<string, unknown>;
  osgi?: Record<string, unknown>;
  eclipse?: Record<string, unknown>;
  talend?: Record<string, unknown>;
};

export type BridgeActiveJobModel = {
  ok: true;
  job?: Record<string, unknown>;
  components?: Array<Record<string, unknown>>;
  connections?: Array<Record<string, unknown>>;
  source?: string;
  confidence?: BridgeConfidence;
  unsupported?: string[];
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

async function readTextFile(rutaArchivo: string): Promise<string | undefined> {
  try {
    return await Bun.file(rutaArchivo).text();
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
  const token = await readTextFile(tokenPath);
  const normalized = token?.trim();
  return normalized ? normalized : undefined;
}

export class TalendStudioBridgeClient {
  private readonly baseUrl: string;

  private readonly token?: string;

  private readonly timeoutMs: number;

  constructor(private readonly config: BridgeConfig, token?: string) {
    this.baseUrl = `http://${config.host}:${config.port}`;
    this.token = token;
    this.timeoutMs = config.timeoutMs;
  }

  static async create(options?: { config?: Partial<BridgeConfig>; token?: string }): Promise<TalendStudioBridgeClient> {
    const config = {
      ...(await readTalendStudioBridgeConfig()),
      ...(options?.config ?? {}),
    };
    return new TalendStudioBridgeClient(config, options?.token ?? (await readTalendStudioBridgeToken()));
  }

  getConfig(): BridgeConfig {
    return this.config;
  }

  async ping(): Promise<BridgeResult<BridgePingPayload>> {
    return await this.request<BridgePingPayload>("/ping", { allowUnauthenticated: true });
  }

  async capabilities(): Promise<BridgeResult<BridgeCapabilities>> {
    return await this.request<BridgeCapabilities>("/capabilities");
  }

  async auditEnvironment(): Promise<BridgeResult<BridgeEnvironment>> {
    return await this.request<BridgeEnvironment>("/audit/environment");
  }

  async workbenchState(): Promise<BridgeResult<BridgeWorkbenchState>> {
    return await this.request<BridgeWorkbenchState>("/workbench/state");
  }

  async selection(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/selection");
  }

  async views(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/workbench/views");
  }

  async activeJobModel(): Promise<BridgeResult<BridgeActiveJobModel>> {
    return await this.request<BridgeActiveJobModel>("/talend/active-job/model");
  }

  async commandsList(): Promise<BridgeResult<{ commands?: BridgeCommand[] }>> {
    return await this.request<{ commands?: BridgeCommand[] }>("/commands/list");
  }

  async executeCommand(commandId: string, dryRun: boolean): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/commands/execute", {
      method: "POST",
      body: { commandId, dryRun },
    });
  }

  async launchConfigs(): Promise<BridgeResult<{ configs?: BridgeLaunchConfig[] }>> {
    return await this.request<{ configs?: BridgeLaunchConfig[] }>("/launch/configs");
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
}
