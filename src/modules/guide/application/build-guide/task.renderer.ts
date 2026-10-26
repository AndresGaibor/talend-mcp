import type { McpToolDefinition } from "../../../../server/adapt-tool";
import { errorResult, okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { GUIDE_RULES, GUIDE_TASKS } from "../../domain/task-catalog";
import { collectToolSummaries } from "./state-collector";
import { scoreTask } from "./text-matching";

/** Secuencia exacta de tools para una tarea, con reglas y alternativas. */
export function renderTask(query: string, listTools: () => McpToolDefinition[]): TalendResult {
  const ranked = [...GUIDE_TASKS]
    .map((task) => ({ task, score: scoreTask(task, query) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score <= 0) {
    return errorResult(
      "talend_guide",
      "TASK_NOT_FOUND",
      `No hay una tarea que coincida con '${query}'.`,
      { availableTasks: GUIDE_TASKS.map((task) => task.id) },
      {
        nextActions: [{ label: "Ver todas las tareas", toolName: "talend_guide", input: { mode: "overview" } }],
      },
    );
  }

  const rules = GUIDE_RULES.filter(
    (rule) => !rule.appliesTo || rule.appliesTo.includes(best.task.id),
  );
  const availableTools = new Set(collectToolSummaries(listTools).map((tool) => tool.name));
  const unavailableRequiredTools = [...new Set(best.task.steps
    .filter((step) => !step.optional && !availableTools.has(step.tool))
    .map((step) => step.tool))];
  const unavailableWarning = unavailableRequiredTools.length > 0
    ? `El preset actual no expone todos los pasos obligatorios: ${unavailableRequiredTools.join(", ")}. Ajusta TALEND_MCP_FILTER o usa el preset all.`
    : undefined;

  return okResult(
    {
      ...best.task,
      steps: best.task.steps.map((step) => ({ ...step, available: availableTools.has(step.tool) })),
      available: unavailableRequiredTools.length === 0,
      unavailableRequiredTools,
      rules: rules.map((rule) => ({ id: rule.id, rule: rule.rule, detail: rule.detail })),
      alternatives: ranked
        .slice(1, 4)
        .filter((item) => item.score > 0)
        .map((item) => item.task.id),
    },
    "talend_guide",
    best.score >= 40 ? "high" : "medium",
    {
      ...(unavailableWarning ? { warnings: [unavailableWarning] } : {}),
      nextActions: best.task.steps
        .filter((step) => availableTools.has(step.tool))
        .slice(0, 2)
        .map((step) => ({
        label: step.purpose,
        toolName: step.tool,
        ...(step.input ? { input: step.input } : {}),
        })),
    },
  );
}
