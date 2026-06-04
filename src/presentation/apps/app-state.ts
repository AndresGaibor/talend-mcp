import { getKnowledgeBase, getErrorStats, getLatestErrors } from "../../talend/diagnostics/error-knowledge-base";
import { diagnoseTalendEnvironment } from "../../talend/diagnostics/workspace-diagnostics";
import { detectAvailableDbComponents } from "../../talend/connections/database-connection";
import { listContextProfiles } from "../../talend/contexts/context-profile";
import { getLiveWatcherStatus } from "../../talend/live/watcher";
import { listJobs } from "../../talend/repository";
import { listRuns } from "../../talend/runner/run-history";
import { listSnapshots } from "../../talend/sync/snapshot-manager";
import { getProbableActiveJob, parseWorkbenchState } from "../../talend/studio/workbench-xmi";
import { getConfiguredProjectPath } from "../../talend/workspace";
import type { PresentationAppId } from "./app-types";

type WorkspaceBundle = {
  jobs: Awaited<ReturnType<typeof listJobs>>;
  runs: Awaited<ReturnType<typeof listRuns>>;
  snapshots: Awaited<ReturnType<typeof listSnapshots>>;
  profiles: ReturnType<typeof listContextProfiles>;
  errorStats: ReturnType<typeof getErrorStats>;
  knowledgeBase: ReturnType<typeof getKnowledgeBase>;
  recentErrors: ReturnType<typeof getLatestErrors>;
};

async function loadWorkspaceBundle(projectPath?: string): Promise<WorkspaceBundle> {
  const [jobs, runs, snapshots] = await Promise.all([
    projectPath ? listJobs(projectPath).catch(() => []) : Promise.resolve([]),
    listRuns({ limit: 10 }).catch(() => []),
    projectPath ? listSnapshots(projectPath).catch(() => []) : Promise.resolve([]),
  ]);

  return {
    jobs,
    runs,
    snapshots,
    profiles: listContextProfiles(),
    errorStats: getErrorStats(),
    knowledgeBase: getKnowledgeBase(),
    recentErrors: getLatestErrors(5),
  };
}

function buildBaseState(projectPath: string | undefined) {
  return {
    projectPath,
    liveWatcher: getLiveWatcherStatus(),
  };
}

export async function buildLauncherInitialStateForApp(appId: PresentationAppId): Promise<Record<string, unknown>> {
  const projectPath = getConfiguredProjectPath();
  const baseState = buildBaseState(projectPath);

  if (appId === "home") {
    const bundle = await loadWorkspaceBundle(projectPath);
    return {
      ...baseState,
      environment: {
        projectPath,
        projectDetected: Boolean(projectPath),
        watcherActive: Boolean(baseState.liveWatcher.ok && baseState.liveWatcher.data?.active),
      },
      quickStats: {
        jobCount: bundle.jobs.length,
        runCount: bundle.runs.length,
        snapshotCount: bundle.snapshots.length,
        profileCount: bundle.profiles.length,
        errorCount: bundle.errorStats.total,
      },
      recentJobs: bundle.jobs.slice(0, 5).map((job) => ({
        label: job.label,
        folderPath: job.folderPath,
        itemPath: job.itemPath,
      })),
      recentRuns: bundle.runs.slice(0, 5),
      recentSnapshots: bundle.snapshots.slice(0, 5),
      recentErrors: bundle.recentErrors,
      errorStats: bundle.errorStats,
    };
  }

  if (!projectPath && appId === "dashboard") {
    const errorStats = getErrorStats();
    return {
      ...baseState,
      environment: {
        projectPath,
        projectDetected: false,
        watcherActive: Boolean(baseState.liveWatcher.ok && baseState.liveWatcher.data?.active),
      },
      quickStats: {
        jobCount: 0,
        runCount: 0,
        snapshotCount: 0,
        profileCount: listContextProfiles().length,
        errorCount: errorStats.total,
      },
      recentJobs: [],
      recentRuns: [],
      recentSnapshots: [],
      recentErrors: getLatestErrors(5),
      errorStats,
    };
  }

  const bundle = await loadWorkspaceBundle(projectPath);

  switch (appId) {
    case "dashboard":
      return {
        ...baseState,
        environment: {
          projectPath,
          projectDetected: Boolean(projectPath),
          watcherActive: Boolean(baseState.liveWatcher.ok && baseState.liveWatcher.data?.active),
        },
        quickStats: {
          jobCount: bundle.jobs.length,
          runCount: bundle.runs.length,
          snapshotCount: bundle.snapshots.length,
          profileCount: bundle.profiles.length,
          errorCount: bundle.errorStats.total,
        },
        recentJobs: bundle.jobs.slice(0, 5).map((job) => ({
          label: job.label,
          folderPath: job.folderPath,
          itemPath: job.itemPath,
        })),
        recentRuns: bundle.runs.slice(0, 5),
        recentSnapshots: bundle.snapshots.slice(0, 5),
        recentErrors: bundle.recentErrors,
        errorStats: bundle.errorStats,
      };
    case "environment-doctor":
      return {
        ...baseState,
        environment: await diagnoseTalendEnvironment().catch((error) => ({ ok: false, error: String(error) })),
        quickStats: {
          jobCount: bundle.jobs.length,
          runCount: bundle.runs.length,
        },
      };
    case "workspace-explorer": {
      const workbench = projectPath
        ? await parseWorkbenchState(projectPath).catch((error) => ({ ok: false, error: String(error) }))
        : { ok: false, error: "No project configured" };
      const activeJob = await getProbableActiveJob().catch((error) => ({ ok: false, error: String(error) }));
      return {
        ...baseState,
        jobs: bundle.jobs.slice(0, 20),
        workbench,
        activeJob,
      };
    }
    case "job-browser":
      return {
        ...baseState,
        jobs: bundle.jobs.slice(0, 50),
        activeJob: await getProbableActiveJob().catch((error) => ({ ok: false, error: String(error) })),
        recentRuns: bundle.runs.slice(0, 5),
      };
    case "run-monitor-pro":
    case "launch-history":
    case "runtime-comparison":
      return {
        ...baseState,
        runs: bundle.runs,
      };
    case "problems-view":
    case "error-explorer":
      return {
        ...baseState,
        errorStats: bundle.errorStats,
        recentErrors: bundle.recentErrors,
        knowledgeBase: {
          version: bundle.knowledgeBase.version,
          errorCount: bundle.knowledgeBase.errors.length,
        },
      };
    case "validation-timeline":
      return {
        ...baseState,
        runs: bundle.runs,
        recentErrors: bundle.recentErrors,
      };
    case "snapshot-manager":
      return {
        ...baseState,
        snapshots: bundle.snapshots,
      };
    case "context-profiles":
    case "secret-safety":
      return {
        ...baseState,
        profiles: bundle.profiles,
        errorStats: bundle.errorStats,
        recentErrors: bundle.recentErrors,
      };
    case "database-connection-wizard":
      return {
        ...baseState,
        dbComponents: {
          postgresql: detectAvailableDbComponents("postgresql"),
          mysql: detectAvailableDbComponents("mysql"),
          sqlserver: detectAvailableDbComponents("sqlserver"),
        },
      };
    default:
      return baseState;
  }
}
