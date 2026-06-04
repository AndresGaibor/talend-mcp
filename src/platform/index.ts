export {
  detectRuntimeOS,
  detectTalendHostOS,
  detectPathMode,
  createPlatformContext,
  isWsl,
} from "./runtime";

export type { RuntimeOS, TalendHostOS, PathMode, PlatformContext } from "./runtime";

export {
  toMcpPath,
  toTalendHostPath,
  normalizeLogicalTalendFolderPath,
  getBaseNamePortable,
  getDirNamePortable,
  splitPortable,
} from "./path-bridge";

export {
  detectJobRunnerStrategy,
  buildScriptExecutionArgs,
  selectScriptByPlatform,
} from "./job-runner-strategy";

export type { ScriptPlatform, JobRunnerStrategy } from "./job-runner-strategy";
