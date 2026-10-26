import type { McpToolDefinition } from "../../../../server/adapt-tool";
import { areaForTool, areaName, requiresStudio } from "../../domain/areas";
import type { GuideTask, GuideToolSummary } from "../../domain/guide.types";

/** Resumen de una tool tal como lo ve el agente. */
export function toSummary(tool: McpToolDefinition): GuideToolSummary {
  return {
    name: tool.name,
    description: tool.description,
    area: areaName(areaForTool(tool.name)),
    readOnly: tool.annotations?.readOnlyHint === true,
    requiresConfirmation: tool.annotations?.requiresConfirmation === true,
    requiresStudio: requiresStudio(tool.name),
  };
}

/** Resumen de una tarea, con los pasos obligatorios que faltan en el preset. */
export function taskSummary(task: GuideTask, availableTools?: Set<string>) {
  const unavailableRequiredTools = availableTools
    ? [...new Set(task.steps
        .filter((step) => !step.optional && !availableTools.has(step.tool))
        .map((step) => step.tool))]
    : [];
  return {
    id: task.id,
    title: task.title,
    goal: task.goal,
    requires: task.requires,
    stepCount: task.steps.length,
    firstTool: task.steps[0]?.tool,
    available: unavailableRequiredTools.length === 0,
    unavailableRequiredTools,
  };
}
