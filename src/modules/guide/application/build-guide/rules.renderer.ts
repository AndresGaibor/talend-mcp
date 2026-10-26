import { okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { GUIDE_RULES } from "../../domain/task-catalog";

/** Reglas de configuración, opcionalmente filtradas por tarea. */
export function renderRules(taskId?: string): TalendResult {
  const selected = taskId
    ? GUIDE_RULES.filter((rule) => !rule.appliesTo || rule.appliesTo.includes(taskId))
    : GUIDE_RULES;
  return okResult(
    {
      count: selected.length,
      task: taskId ?? null,
      rules: selected.map((rule) => ({ id: rule.id, rule: rule.rule, detail: rule.detail })),
    },
    "talend_guide",
    "high",
  );
}
