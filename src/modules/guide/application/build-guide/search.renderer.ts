import { errorResult, okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { GUIDE_TASKS } from "../../domain/task-catalog";
import type { GuideToolSummary } from "../../domain/guide.types";
import { scoreTask, scoreTool } from "./text-matching";

/** Busca tools y tareas por texto libre. */
export function renderSearch(query: string, limit: number, toolsSummary: GuideToolSummary[]): TalendResult {
  const max = Math.max(1, Math.min(limit, 50));
  const tools = toolsSummary
    .map((tool) => ({ tool, score: scoreTool(tool, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, max)
    .map((item) => item.tool);

  const tasks = GUIDE_TASKS
    .map((task) => ({ task, score: scoreTask(task, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.task.id);

  if (tools.length === 0 && tasks.length === 0) {
    return errorResult("talend_guide", "NO_MATCHES", `Sin resultados para '${query}'.`, undefined, {
      nextActions: [{ label: "Ver todas las tareas", toolName: "talend_guide", input: { mode: "overview" } }],
    });
  }

  return okResult({ query, tools, tasks }, "talend_guide", tools.length > 0 ? "high" : "medium");
}
