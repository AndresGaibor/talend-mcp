import type { RepairOptions } from "./repair/repair";
import { defaultRepairDeps, repair } from "./repair/repair";

export { planSafeConfig, type RepairConfigPlan } from "./repair/config";
export { clearHotJar, hotJarFiles } from "./repair/hot-jar";
export { removeSupervisorTask, stopSupervisorProcesses, supervisorTaskInstalled } from "./repair/supervisor";
export {
  defaultRepairDeps,
  pluginJarVersion,
  repair,
  type RepairDeps,
  type RepairOptions,
  type RepairReporter,
  type RepairResult,
} from "./repair/repair";

/** Entrada de la CLI. Devuelve el codigo de salida. */
export async function runRepairCommand(opts: RepairOptions = {}): Promise<number> {
  try {
    const result = await repair(defaultRepairDeps, opts);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
