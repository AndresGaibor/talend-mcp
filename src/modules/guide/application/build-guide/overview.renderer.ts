import { okResult, type TalendResult } from "../../../../shared/contracts/result.contract";
import { getConfiguredProjectPath } from "../../../../talend/workspace";
import { GUIDE_AREAS } from "../../domain/areas";
import { buildServerInstructions } from "../../domain/server-instructions";
import { GUIDE_TASKS } from "../../domain/task-catalog";
import type { GuideToolSummary } from "../../domain/guide.types";
import { taskSummary } from "./summaries";

/** Punto de entrada: mapa de tareas, familias y estado básico. */
export function renderOverview(tools: GuideToolSummary[]): TalendResult {
  const availableTools = new Set(tools.map((tool) => tool.name));
  const byArea = new Map<string, number>();
  for (const tool of tools) {
    byArea.set(tool.area, (byArea.get(tool.area) ?? 0) + 1);
  }

  return okResult(
    {
      instructions: buildServerInstructions(),
      toolCount: tools.length,
      projectConfigured: getConfiguredProjectPath() ?? null,
      tasks: GUIDE_TASKS.map((task) => taskSummary(task, availableTools)),
      areas: GUIDE_AREAS
        .map((area) => ({ id: area.id, name: area.name, useFor: area.useFor, toolCount: byArea.get(area.name) ?? 0 }))
        .filter((area) => area.toolCount > 0),
      modes: {
        overview: "Mapa de tareas, familias y estado basico. Es el modo por defecto.",
        task: "Secuencia exacta de tools para una tarea (`task`: id o texto libre).",
        tool: "Detalle de una tool: descripcion, familia, riesgo y schema de entrada (`tool`).",
        search: "Busca tools y tareas por texto (`query`).",
        rules: "Reglas de configuracion que evitan fallos silenciosos.",
        environment: "Comprueba el proyecto configurado y si el bridge de Studio responde.",
      },
      convention:
        "Toda tool devuelve { ok, source, confidence, data, warnings, errors, nextActions }. Sigue `nextActions` cuando venga.",
    },
    "talend_guide",
    "high",
    {
      nextActions: [
        {
          label: "Ver una tarea paso a paso",
          toolName: "talend_guide",
          input: { mode: "task", task: "crear-job" },
        },
        {
          label: "Comprobar el entorno",
          toolName: "talend_guide",
          input: { mode: "environment" },
        },
      ],
    },
  );
}
