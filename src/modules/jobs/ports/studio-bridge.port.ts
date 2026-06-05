export type StudioBridgeCommand = {
  action: "apply-pipeline" | "preview-pipeline" | "validate-pipeline";
  jobId?: string;
  payload: Record<string, unknown>;
};

export type StudioBridgeResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export interface IStudioBridge {
  executeCommand(command: StudioBridgeCommand): Promise<StudioBridgeResponse>;
  isAvailable(): Promise<boolean>;
}