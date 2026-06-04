export type BridgeCapability =
  | "ping"
  | "capabilities"
  | "audit"
  | "workbench"
  | "active_job"
  | "commands"
  | "launch_configs"
  | "problems"
  | "open_jobs";

export type BridgeCommand = {
  name: string;
  args?: Record<string, string>;
};

export interface StudioBridgeClient {
  ping(): Promise<boolean>;
  getCapabilities(): Promise<BridgeCapability[]>;
  executeCommand(command: BridgeCommand): Promise<unknown>;
  getLaunchConfigs(): Promise<LaunchConfig[]>;
  getOpenJobs(): Promise<OpenJob[]>;
}

import type { OpenJob, LaunchConfig } from "../workspace/workspace.entity";