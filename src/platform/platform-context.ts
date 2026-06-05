import type { RuntimeOS, TalendHostOS, PathMode, PlatformContext } from "./runtime";
import { createPlatformContext as internalCreatePlatformContext } from "./runtime";

export type { RuntimeOS, TalendHostOS, PathMode, PlatformContext };

export { createPlatformContext } from "./runtime";

export function createPlatformContextEx(overrides?: {
  talendHostOs?: string;
  pathMode?: string;
  runtimeOs?: RuntimeOS;
  platformOverrides?: { platform?: string; isWslOverride?: boolean };
}): PlatformContext {
  return internalCreatePlatformContext(overrides);
}