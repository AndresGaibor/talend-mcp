export * from "./ports/studio-bridge.port";
export * from "./adapters/http-studio-bridge.client";
export * from "./adapters/http-studio-bridge.adapter";
export * from "./application/ping-bridge.usecase";
export * from "./application/open-resource.usecase";
export * from "./application/get-workspace-state.usecase";
export * from "./application/get-problems.usecase";
export * from "./application/list-launches.usecase";

// Re-export tools from presentation layer for backwards compatibility during migration
export { createDetectProcessTool } from "../../presentation/tools/studio/detect-process.tool";
export { createDiagnoseEnvironmentTool } from "../../presentation/tools/studio/diagnose-environment.tool";
export { createListLaunchConfigsTool } from "../../presentation/tools/studio/list-launch-configs.tool";
export { createListOpenEditorsTool } from "../../presentation/tools/studio/list-open-editors.tool";

export const studioBridgeTools = [
  // Legacy tools from presentation layer - to be migrated
];