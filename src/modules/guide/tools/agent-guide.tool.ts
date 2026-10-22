import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { McpToolDefinition } from "../../../server/adapt-tool";
import type { TalendResult } from "../../../shared/contracts/result.contract";
import { BuildGuideUseCase } from "../application/build-guide.use-case";

export const AgentGuideSchema = z.object({
  mode: z
    .enum(["overview", "task", "tool", "search", "rules", "environment"])
    .optional()
    .default("overview")
    .describe(
      "overview (mapa de tareas), task (pasos de una tarea), tool (detalle de una tool), search (buscar), rules (reglas de configuracion), environment (proyecto y bridge)",
    ),
  task: z
    .string()
    .optional()
    .describe("Solo con mode=task: id de la tarea (crear-job, editar-job...) o texto libre como 'crear un job'"),
  tool: z
    .string()
    .optional()
    .describe("Solo con mode=tool: nombre de la tool (talend_jobs_list o jobs_list)"),
  query: z
    .string()
    .optional()
    .describe("Solo con mode=search: texto a buscar en nombres y descripciones"),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Solo con mode=search: maximo de tools a devolver"),
  includeSchema: z
    .boolean()
    .optional()
    .default(true)
    .describe("Solo con mode=tool: incluir el schema de entrada"),
});

// The transport applies Zod defaults before calling the handler. Use the input
// type here so local callers and tests may also omit those defaulted fields.
export type AgentGuideInput = z.input<typeof AgentGuideSchema>;

function renderText(result: TalendResult): string {
  if (!result.ok) {
    const error = result.errors?.[0];
    const lines = [`Error ${error?.code ?? "UNKNOWN"}: ${error?.message ?? "sin detalle"}`];
    const details = error?.details as Record<string, unknown> | undefined;
    const suggestions = details?.suggestions ?? details?.availableTasks;
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      lines.push(`Opciones: ${suggestions.join(", ")}`);
    }
    return lines.join("\n");
  }

  const data = (result.data ?? {}) as Record<string, any>;

  if (Array.isArray(data.tasks) && Array.isArray(data.areas)) {
    const lines = [
      `${data.toolCount} tools expuestas. Proyecto: ${data.projectConfigured ?? "no configurado (define TALEND_PROJECT)"}.`,
      "",
      "Tareas:",
    ];
    for (const task of data.tasks) {
      const availability = task.available ? "disponible" : "incompleta con el preset actual";
      lines.push(`- ${task.id}: ${task.title} (${task.stepCount} pasos, ${availability})`);
    }
    lines.push(
      "",
      "Siguiente paso: talend_guide { mode: \"task\", task: \"<id>\" }. Reglas: { mode: \"rules\" }. Entorno: { mode: \"environment\" }.",
    );
    return lines.join("\n");
  }

  if (Array.isArray(data.steps)) {
    const lines = [
      `${data.id}: ${data.title}`,
      `Cuando: ${data.whenToUse}`,
      `Requiere: ${Array.isArray(data.requires) && data.requires.length > 0 ? data.requires.join(", ") : "solo el proyecto"}`,
      "",
      "Pasos:",
    ];
    data.steps.forEach((step: any, index: number) => {
      const optional = step.optional ? " (opcional)" : "";
      const unavailable = step.available === false ? " [no expuesta por este preset]" : "";
      lines.push(`${index + 1}. ${step.tool}${optional}${unavailable}: ${step.purpose}`);
      if (step.input) lines.push(`   ejemplo: ${JSON.stringify(step.input)}`);
    });
    if (Array.isArray(data.rules) && data.rules.length > 0) {
      lines.push("", "Reglas:");
      for (const rule of data.rules) lines.push(`- ${rule.rule}`);
    }
    lines.push("", `Listo cuando: ${data.doneWhen}`);
    return lines.join("\n");
  }

  if (Array.isArray(data.tools)) {
    if (data.tools.length === 0) return `Sin tools para '${data.query}'.`;
    const lines = [`Tools para '${data.query}':`];
    for (const tool of data.tools) {
      lines.push(`- ${tool.name}: ${tool.description}${tool.requiresStudio ? " [Studio]" : ""}`);
    }
    if (Array.isArray(data.tasks) && data.tasks.length > 0) {
      lines.push(`Tareas relacionadas: ${data.tasks.join(", ")}`);
    }
    return lines.join("\n");
  }

  if (typeof data.name === "string" && typeof data.description === "string") {
    return [
      `${data.name}: ${data.description}`,
      `Familia: ${data.area}. Solo lectura: ${data.readOnly ? "si" : "no"}. Necesita Studio: ${data.requiresStudio ? "si" : "no"}.`,
      data.whenToUse,
    ].join("\n");
  }

  if (Array.isArray(data.rules) && typeof data.count === "number") {
    return data.rules
      .map((rule: any, index: number) => `${index + 1}. ${rule.rule}\n   ${rule.detail}`)
      .join("\n");
  }

  return JSON.stringify(data, null, 2);
}

export function createAgentGuideTool(options: { listTools: () => McpToolDefinition[] }) {
  const useCase = new BuildGuideUseCase(options.listTools);

  return {
    name: "talend_guide",
    description:
      "Punto de entrada para agentes: mapa de tareas de Talend con la secuencia exacta de tools, busqueda de tools, reglas de configuracion que evitan fallos silenciosos y estado del proyecto y del bridge. Empieza por mode=overview.",
    inputSchema: AgentGuideSchema,
    annotations: {
      readOnly: true,
    },
    handler: async (input: AgentGuideInput): Promise<CallToolResult> => {
      const mode = input.mode ?? "overview";

      let result: TalendResult;
      switch (mode) {
        case "task":
          result = input.task
            ? useCase.task(input.task)
            : {
                ok: false,
                source: "talend_guide",
                confidence: "none",
                errors: [{ code: "MISSING_TASK", message: "mode=task requiere el campo `task`." }],
              };
          break;
        case "tool":
          result = useCase.describeTool(input.tool ?? "", input.includeSchema ?? true);
          break;
        case "search":
          result = useCase.search(input.query ?? "", input.limit ?? 15);
          break;
        case "rules":
          result = useCase.rules(input.task);
          break;
        case "environment":
          result = await useCase.environment();
          break;
        default:
          result = useCase.overview();
          break;
      }

      return {
        content: [{ type: "text", text: renderText(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
        isError: !result.ok,
      };
    },
  };
}
