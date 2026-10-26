import type { McpToolDefinition } from "../../../../server/adapt-tool";
import { errorResult, okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { GUIDE_TASKS } from "../../domain/task-catalog";
import { collectToolSummaries } from "./state-collector";
import { toSummary } from "./summaries";
import { normalize, scoreTool } from "./text-matching";

/** Detalle de una tool: resumen, schema y tareas donde aparece. */
export function renderDescribeTool(
  name: string,
  includeSchema: boolean,
  listTools: () => McpToolDefinition[],
): TalendResult {
  const normalized = normalize(name).startsWith("talend_") ? normalize(name) : normalize(`talend_${name}`);
  const raw = listTools().find((tool) => normalize(tool.name) === normalized);
  if (!raw) {
    const suggestions = collectToolSummaries(listTools)
      .map((tool) => ({ tool, score: scoreTool(tool, name) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.tool.name);
    return errorResult("talend_guide", "TOOL_NOT_FOUND", `No existe la tool '${name}'.`, { suggestions }, {
      nextActions: suggestions[0]
        ? [{ label: "Ver la tool sugerida", toolName: "talend_guide", input: { mode: "tool", tool: suggestions[0] } }]
        : [{ label: "Buscar tools", toolName: "talend_guide", input: { mode: "search", query: name } }],
    });
  }

  const summary = toSummary(raw);
  const relatedTasks = GUIDE_TASKS
    .filter((task) => task.steps.some((step) => step.tool === raw.name))
    .map((task) => task.id);

  return okResult(
    {
      ...summary,
      ...(includeSchema ? { inputSchema: raw.inputSchema } : {}),
      relatedTasks,
      whenToUse:
        relatedTasks.length > 0
          ? `Aparece en las tareas: ${relatedTasks.join(", ")}. Usa talend_guide { mode: "task", task: "<id>" } para ver el contexto.`
          : "No aparece en ninguna tarea del catalogo; consulta su schema antes de usarla.",
    },
    "talend_guide",
    "high",
  );
}
