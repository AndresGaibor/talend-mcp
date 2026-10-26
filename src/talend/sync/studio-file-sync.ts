// Fachada de sincronizacion con Studio. La implementacion vive en ./studio-file/.
export type { SyncStatus, SyncStep, SyncResult } from "./studio-file/types";
export { getSyncStatus } from "./studio-file/status";
export { beforeFileEdit, afterFileEdit } from "./studio-file/lifecycle";
export {
  safeEditComponentParameter,
  safePatchComponent,
  safeAddConnection,
} from "./studio-file/safe-editors";
