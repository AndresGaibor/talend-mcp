import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { PathTriple } from "./PathTriple";
import { DiagnosticCheck } from "./DiagnosticCheck";

interface BridgePingResult {
  studioRunning: boolean;
  version?: string;
}

interface WorkspaceState {
  runtimeOs?: string;
  talendHostOs?: string;
  pathMode?: string;
  projectPath?: string;
  workspace?: string;
  rawPath?: string;
  mcpPath?: string;
  talendHostPath?: string;
}

interface DiagnosticResult {
  label: string;
  success: boolean;
  description?: string;
  details?: string;
}

interface CapabilityResult {
  canReadProject: boolean;
  canReadProcess: boolean;
  canReadMetadata: boolean;
}

interface ResourceResult {
  canOpenResource: boolean;
  canScanPlugins: boolean;
}

interface CommandSet {
  macos: string;
  windows: string;
  wsl: string;
}

export function EnvironmentDoctorApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [bridgePing, setBridgePing] = useState<BridgePingResult | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityResult | null>(null);
  const [resources, setResources] = useState<ResourceResult | null>(null);
  const [bridgeConfigPath, setBridgeConfigPath] = useState<string | null>(null);
  const [bridgeTokenPath, setBridgeTokenPath] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadBridgePing = useCallback(async () => {
    const result = await callTool("talend_bridge_ping", {});
    if (result.success && result.result) {
      try {
        setBridgePing(JSON.parse(result.result));
      } catch {
        setBridgePing({ studioRunning: false });
      }
    } else {
      setBridgePing(null);
    }
  }, [callTool]);

  const loadWorkspaceState = useCallback(async () => {
    const result = await callTool("talend_bridge_workspace_state", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setWorkspace(data);
        setBridgeConfigPath(data.bridgeConfigPath ?? null);
        setBridgeTokenPath(data.bridgeTokenPath ?? null);
      } catch {
        setWorkspace(null);
      }
    } else {
      setWorkspace(null);
    }
  }, [callTool]);

  const loadCapabilities = useCallback(async () => {
    const result = await callTool("talend_can_read_project", {});
    const canReadProject = result.success;

    const procResult = await callTool("talend_can_read_process", {});
    const canReadProcess = procResult.success;

    const metaResult = await callTool("talend_can_read_metadata", {});
    const canReadMetadata = metaResult.success;

    setCapabilities({ canReadProject, canReadProcess, canReadMetadata });
  }, [callTool]);

  const loadResources = useCallback(async () => {
    const openResult = await callTool("talend_bridge_open_resource", { path: "/test" });
    const canOpenResource = openResult.success;

    const scanResult = await callTool("talend_components_scan_installed", {});
    const canScanPlugins = scanResult.success;

    setResources({ canOpenResource, canScanPlugins });
  }, [callTool]);

  useEffect(() => {
    const loadAll = async () => {
      setError(null);
      await Promise.all([
        loadBridgePing(),
        loadWorkspaceState(),
        loadCapabilities(),
        loadResources(),
      ]);
    };
    loadAll();
  }, [loadBridgePing, loadWorkspaceState, loadCapabilities, loadResources]);

  useEffect(() => {
    const diag: DiagnosticResult[] = [];

    if (capabilities) {
      diag.push({
        label: "Can Read Project",
        success: capabilities.canReadProject,
        details: capabilities.canReadProject ? "Project path accessible" : "Cannot read project path",
      });
      diag.push({
        label: "Can Read Process",
        success: capabilities.canReadProcess,
        details: capabilities.canReadProcess ? "Process files accessible" : "Cannot read process files",
      });
      diag.push({
        label: "Can Read Metadata",
        success: capabilities.canReadMetadata,
        details: capabilities.canReadMetadata ? "Metadata accessible" : "Cannot read metadata",
      });
    }

    if (bridgePing) {
      diag.push({
        label: "Bridge Ping",
        success: bridgePing.studioRunning,
        description: "Talend Studio connection",
        details: bridgePing.version ? `Version: ${bridgePing.version}` : undefined,
      });
    }

    if (resources) {
      diag.push({
        label: "Can Open Resource",
        success: resources.canOpenResource,
        details: resources.canOpenResource ? "Resource access OK" : "Cannot open resources",
      });
      diag.push({
        label: "Can Scan Plugins",
        success: resources.canScanPlugins,
        details: resources.canScanPlugins ? "Plugin scan OK" : "Cannot scan plugins",
      });
    }

    setDiagnostics(diag);
  }, [capabilities, bridgePing, resources]);

  const generateCommands = (): CommandSet => {
    const rawPath = workspace?.rawPath ?? "/Users/user/TalendStudio";
    return {
      macos: `export TALEND_BRIDGE_PATH="${rawPath}"\nsource ~/.talend/bridge-env.sh`,
      windows: `$env:TALEND_BRIDGE_PATH="${rawPath}"\n. "$env:USERPROFILE\\.talend\\bridge-env.ps1"`,
      wsl: `export TALEND_BRIDGE_PATH="${rawPath}"\nsource ~/.talend/bridge-env.sh`,
    };
  };

  const commands = generateCommands();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Environment Doctor</h2>
          <p className="text-gray-500 mt-1">Diagnose Talend MCP configuration</p>
        </div>
        <button
          onClick={async () => {
            setError(null);
            await Promise.all([loadBridgePing(), loadWorkspaceState(), loadCapabilities(), loadResources()]);
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Running..." : "Re-run Diagnostics"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {workspace && (
        <PathTriple
          rawPath={workspace.rawPath ?? workspace.projectPath ?? null}
          mcpPath={workspace.mcpPath ?? null}
          talendHostPath={workspace.talendHostPath ?? null}
        />
      )}

      <Card className="p-4">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Bridge Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-400">Config Path</span>
            <code className="block text-sm font-mono text-gray-700 mt-1 break-all">
              {bridgeConfigPath ?? "—"}
            </code>
          </div>
          <div>
            <span className="text-xs text-gray-400">Token Path</span>
            <code className="block text-sm font-mono text-gray-700 mt-1 break-all">
              {bridgeTokenPath ?? "—"}
            </code>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {diagnostics.map((d, i) => (
          <DiagnosticCheck key={i} {...d} />
        ))}
      </div>

      {diagnostics.length === 0 && !isLoading && (
        <Card className="p-6 text-center text-gray-500">
          Click "Re-run Diagnostics" to start
        </Card>
      )}

      <Card className="p-4">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Setup Commands</h4>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">macOS / Linux</span>
              <button
                onClick={() => navigator.clipboard.writeText(commands.macos)}
                className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-x-auto">{commands.macos}</pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">Windows PowerShell</span>
              <button
                onClick={() => navigator.clipboard.writeText(commands.windows)}
                className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-x-auto">{commands.windows}</pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">WSL</span>
              <button
                onClick={() => navigator.clipboard.writeText(commands.wsl)}
                className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-x-auto">{commands.wsl}</pre>
          </div>
        </div>
      </Card>
    </div>
  );
}