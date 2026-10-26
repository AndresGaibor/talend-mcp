import type { SyncResult, SyncStep } from "./types";

// Combina los pasos previos a la escritura con los posteriores y decide el ok final.
export function mergeSyncResults(
  beforeSteps: SyncStep[],
  beforeSnapshotPath: string | null,
  writeStepName: string,
  afterResult: SyncResult
): SyncResult {
  const mergedSteps = [...beforeSteps, ...afterResult.steps];

  const criticalStepNames = [
    "validate_inputs",
    "snapshot_created",
    writeStepName,
    "write_item_file",
  ];
  const criticalSteps = mergedSteps.filter((s) => criticalStepNames.includes(s.name));
  const finalOk = criticalSteps.every((s) => s.ok);

  return {
    ...afterResult,
    ok: finalOk,
    steps: mergedSteps,
    snapshotPath: beforeSnapshotPath,
  };
}
