import type { Confidence } from "../diagnostics/types";
import type { RunHistoryEntry } from "../runner/run-history";

export interface LiveTalendState {
  startedAt: string;
  workspacePath?: string;
  projectPath?: string;
  projectName?: string;
  lastFileChange?: {
    path: string;
    event: "created" | "modified" | "deleted" | "unknown";
    at: string;
  };
  probableOpenJob?: {
    jobName: string;
    source: "workbench-xmi" | "studio-bridge";
    confidence: Confidence;
    detectedAt: string;
  };
  lastRun?: RunHistoryEntry;
  lastStudioError?: {
    message: string;
    source: "metadata-log";
    detectedAt: string;
    snippet?: string;
  };
  warnings: string[];
}

const defaultState: LiveTalendState = {
  startedAt: new Date().toISOString(),
  warnings: [],
};

let currentState: LiveTalendState = { ...defaultState };

export function getLiveTalendState(): LiveTalendState {
  return { ...currentState };
}

export function updateLiveTalendState(partial: Partial<LiveTalendState>): LiveTalendState {
  currentState = { ...currentState, ...partial };
  return currentState;
}

export function resetLiveTalendState(): void {
  currentState = { ...defaultState, startedAt: new Date().toISOString() };
}
