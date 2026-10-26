import type { GuideTask } from "../guide.types";
import { ORIENTATION_TASKS } from "./orientation.tasks";
import { JOB_LIFECYCLE_TASKS } from "./job-lifecycle.tasks";
import { JOB_RUNS_TASKS } from "./job-runs.tasks";
import { CONTEXTS_TASKS } from "./contexts.tasks";
import { COMPONENT_DISCOVERY_TASKS } from "./component-discovery.tasks";
import { INSPECTION_TASKS } from "./inspection.tasks";
import { DATASETS_TASKS } from "./datasets.tasks";
import { DELIVERY_TASKS } from "./delivery.tasks";
import { DATA_QUALITY_TASKS } from "./data-quality.tasks";
import { REPOSITORIES_TASKS } from "./repositories.tasks";
import { SNAPSHOTS_TASKS } from "./snapshots.tasks";
import { PIPELINE_SPEC_TASKS } from "./pipeline-spec.tasks";
import { MASTERY_TASKS } from "./mastery.tasks";

/**
 * Catalogo de tareas: la respuesta a "quiero hacer X, que tools uso y en que
 * orden". Es la fuente unica de verdad: la tool `talend_guide`, las
 * instrucciones del servidor y `docs/CATALOGO-DE-TOOLS.md` salen de aqui.
 *
 * Al cambiar una tool, actualiza su paso. El test
 * `tests/tools/agent-guide.test.ts` falla si un paso apunta a una tool que no
 * existe.
 */
export const GUIDE_TASKS: GuideTask[] = [
  ...ORIENTATION_TASKS,
  ...JOB_LIFECYCLE_TASKS,
  ...JOB_RUNS_TASKS,
  ...CONTEXTS_TASKS,
  ...COMPONENT_DISCOVERY_TASKS,
  ...INSPECTION_TASKS,
  ...DATASETS_TASKS,
  ...DELIVERY_TASKS,
  ...DATA_QUALITY_TASKS,
  ...REPOSITORIES_TASKS,
  ...SNAPSHOTS_TASKS,
  ...PIPELINE_SPEC_TASKS,
  ...MASTERY_TASKS,
];

export { GUIDE_RULES } from "./rules";

/** Identificadores de las tareas, en el orden del catalogo. */
export const GUIDE_TASK_IDS = GUIDE_TASKS.map((task) => task.id);
