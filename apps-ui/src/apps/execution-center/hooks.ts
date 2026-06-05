import { useState, useCallback, useEffect } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { LaunchConfig, ExecutionRun, RunStatus } from "./types";

export function useLaunchConfigs() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [configs, setConfigs] = useState<LaunchConfig[]>([]);

  const fetchConfigs = useCallback(async () => {
    const result = await callTool("talend_launch_configs_list", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setConfigs(Array.isArray(data) ? data : data.configs || []);
      } catch {
        setConfigs([]);
      }
    }
    return result;
  }, [callTool]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    isLoading,
    error,
    fetchConfigs,
  };
}

export function useRecentRuns() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);

  const fetchRuns = useCallback(async (limit = 50) => {
    const result = await callTool("talend_runs_list", { limit });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        const runsData = Array.isArray(data) ? data : data.runs || [];
        setRuns(runsData.map(normalizeRun));
      } catch {
        setRuns([]);
      }
    }
    return result;
  }, [callTool]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return {
    runs,
    isLoading,
    error,
    fetchRuns,
  };
}

export function useRunDetails(runId: string | null) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [run, setRun] = useState<ExecutionRun | null>(null);

  const fetchRunDetails = useCallback(async () => {
    if (!runId) return null;
    const result = await callTool("talend_runs_read", { runId });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setRun(normalizeRun(data));
      } catch {
        setRun(null);
      }
    }
    return result;
  }, [callTool, runId]);

  useEffect(() => {
    if (runId) {
      fetchRunDetails();
    } else {
      setRun(null);
    }
  }, [runId, fetchRunDetails]);

  return {
    run,
    isLoading,
    error,
    fetchRunDetails,
  };
}

export function useExecutionData() {
  const { configs } = useLaunchConfigs();
  const { runs, fetchRuns } = useRecentRuns();
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);

  const selectRun = useCallback((run: ExecutionRun | null) => {
    setSelectedRun(run);
  }, []);

  return {
    configs,
    runs,
    selectedRun,
    selectRun,
    refreshRuns: fetchRuns,
  };
}

function normalizeRun(data: Record<string, unknown>): ExecutionRun {
  const status: RunStatus["status"] = (data.status as RunStatus["status"]) || "UNKNOWN";
  return {
    runId: (data.runId || data.id || "") as string,
    jobName: (data.jobName || data.name || "") as string,
    configId: data.configId as string | undefined,
    status,
    startTime: data.startTime as string | undefined,
    endTime: data.endTime as string | undefined,
    duration: data.duration as number | undefined,
    logs: (data.logs || []) as ExecutionRun["logs"],
    events: (data.events || []) as ExecutionRun["events"],
    outputs: (data.outputs || []) as ExecutionRun["outputs"],
    errorCount: data.errorCount as number | undefined,
    warningCount: data.warningCount as number | undefined,
  };
}
