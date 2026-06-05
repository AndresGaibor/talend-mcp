import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { HomeStatusCards } from "./HomeStatusCards";
import { HomeQuickActions } from "./HomeQuickActions";

interface BridgeStatus {
  connected: boolean;
  studioRunning: boolean;
  lastPing?: string;
}

interface WorkspaceState {
  runtimeOs?: string;
  talendHostOs?: string;
  pathMode?: string;
  projectPath?: string;
  workspace?: string;
}

interface JobsInfo {
  count: number;
  jobs: Array<{ name: string; status: string }>;
}

interface ProblemsInfo {
  count: number;
  problems: Array<{ severity: string; message: string }>;
}

export function HomeApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ connected: false, studioRunning: false });
  const [workspace, setWorkspace] = useState<WorkspaceState>({});
  const [jobsInfo, setJobsInfo] = useState<JobsInfo>({ count: 0, jobs: [] });
  const [problemsInfo, setProblemsInfo] = useState<ProblemsInfo>({ count: 0, problems: [] });
  const [error, setError] = useState<string | null>(null);

  const loadBridgeStatus = useCallback(async () => {
    const result = await callTool("talend_bridge_ping", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setBridgeStatus({
          connected: true,
          studioRunning: data.studioRunning ?? false,
          lastPing: new Date().toISOString(),
        });
      } catch {
        setBridgeStatus({ connected: true, studioRunning: false });
      }
    } else {
      setBridgeStatus({ connected: false, studioRunning: false });
    }
  }, [callTool]);

  const loadWorkspaceState = useCallback(async () => {
    const result = await callTool("talend_bridge_workspace_state", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setWorkspace({
          runtimeOs: data.runtimeOs,
          talendHostOs: data.talendHostOs,
          pathMode: data.pathMode,
          projectPath: data.projectPath,
          workspace: data.workspace,
        });
      } catch {
        // Ignore parse errors
      }
    }
  }, [callTool]);

  const loadJobs = useCallback(async () => {
    const result = await callTool("talend_jobs_list", { limit: 100 });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        const jobs = Array.isArray(data) ? data : data.jobs ?? [];
        setJobsInfo({ count: jobs.length, jobs: jobs.slice(0, 5) });
      } catch {
        setJobsInfo({ count: 0, jobs: [] });
      }
    }
  }, [callTool]);

  const loadProblems = useCallback(async () => {
    const result = await callTool("talend_bridge_problems_markers", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        const problems = Array.isArray(data) ? data : data.problems ?? [];
        setProblemsInfo({ count: problems.length, problems: problems.slice(0, 5) });
      } catch {
        setProblemsInfo({ count: 0, problems: [] });
      }
    }
  }, [callTool]);

  useEffect(() => {
    const loadAll = async () => {
      setError(null);
      await Promise.all([
        loadBridgeStatus(),
        loadWorkspaceState(),
        loadJobs(),
        loadProblems(),
      ]);
    };
    loadAll();
  }, [loadBridgeStatus, loadWorkspaceState, loadJobs, loadProblems]);

  const recommendedApps = [
    { name: "Jobs", description: "Manage and run Talend jobs", icon: "⚙️" },
    { name: "Problems", description: "View and resolve issues", icon: "🔧" },
    { name: "Snapshots", description: "Manage snapshots", icon: "📸" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Home</h2>
          <p className="text-gray-500 mt-1">Dashboard overview</p>
        </div>
        <button
          onClick={() => {
            loadBridgeStatus();
            loadWorkspaceState();
            loadJobs();
            loadProblems();
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <HomeStatusCards
        bridgeStatus={bridgeStatus}
        workspace={workspace}
        jobsCount={jobsInfo.count}
        problemsCount={problemsInfo.count}
      />

      <HomeQuickActions />

      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Apps</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedApps.map((app) => (
            <button
              key={app.name}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <span className="text-2xl">{app.icon}</span>
              <h4 className="font-medium text-gray-900 mt-2">{app.name}</h4>
              <p className="text-sm text-gray-500 mt-1">{app.description}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
