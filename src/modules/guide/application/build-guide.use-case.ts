import type { McpToolDefinition } from "../../../server/adapt-tool";
import { okResult, errorResult, type TalendResult } from "../../../shared/contracts/result.contract";
import { getConfiguredProjectPath } from "../../../talend/workspace";
import { GUIDE_AREAS, areaForTool, areaName, requiresStudio } from "../domain/areas";
import { GUIDE_RULES, GUIDE_TASKS } from "../domain/task-catalog";
import { buildServerInstructions } from "../domain/server-instructions";
import type { GuideTask, GuideToolSummary } from "../domain/guide.types";

const SOURCE = "talend_guide";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length > 1 && !new Set(["de", "del", "la", "las", "el", "los", "un", "una", "para", "por", "con", "que", "como"]).has(token));
}

function toSummary(tool: McpToolDefinition): GuideToolSummary {
  return {
    name: tool.name,
    description: tool.description,
    area: areaName(areaForTool(tool.name)),
    readOnly: tool.annotations?.readOnlyHint === true,
    requiresConfirmation: tool.annotations?.requiresConfirmation === true,
    requiresStudio: requiresStudio(tool.name),
  };
}

function taskSummary(task: GuideTask, availableTools?: Set<string>) {
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

function scoreTask(task: GuideTask, query: string): number {
  const q = normalize(query).trim();
  if (!q) return 0;
  if (normalize(task.id) === q) return 100;
  let score = 0;
  if (normalize(task.id).includes(q)) score += 40;
  if (normalize(task.title).includes(q)) score += 25;
  if (task.aliases.some((alias) => normalize(alias).includes(q))) score += 20;
  if (normalize(task.goal).includes(q)) score += 10;
  for (const token of tokens(q)) {
    if (normalize(task.id).includes(token)) score += 6;
    if (normalize(task.title).includes(token)) score += 5;
    if (task.aliases.some((alias) => normalize(alias).includes(token))) score += 4;
    if (task.steps.some((step) => normalize(step.tool).includes(token))) score += 3;
    if (normalize(task.whenToUse).includes(token)) score += 2;
  }
  return score;
}

function scoreTool(tool: GuideToolSummary, query: string): number {
  const q = normalize(query).trim();
  if (!q) return 0;
  if (tool.name === q || tool.name === `talend_${q}`) return 100;
  let score = 0;
  if (tool.name.includes(q.replace(/\s+/g, "_"))) score += 40;
  if (tool.description && normalize(tool.description).includes(q)) score += 12;
  for (const token of tokens(q)) {
    if (tool.name.includes(token)) score += 6;
    if (normalize(tool.description).includes(token)) score += 2;
    if (normalize(tool.area).includes(token)) score += 1;
  }
  const queryTokens = tokens(q);
  if (queryTokens.length > 1) {
    const searchable = normalize(`${tool.name} ${tool.description} ${tool.area}`);
    const matchedTokens = queryTokens.filter((token) => searchable.includes(token)).length;
    if (matchedTokens === queryTokens.length) score += 25;
    else score -= (queryTokens.length - matchedTokens) * 4;
  }
  return score;
}

export class BuildGuideUseCase {
  constructor(private readonly listTools: () => McpToolDefinition[]) {}

  private tools(): GuideToolSummary[] {
    return this.listTools().map(toSummary);
  }

  overview(): TalendResult {
    const tools = this.tools();
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
      SOURCE,
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

  task(query: string): TalendResult {
    const ranked = [...GUIDE_TASKS]
      .map((task) => ({ task, score: scoreTask(task, query) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score <= 0) {
      return errorResult(
        SOURCE,
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
    const availableTools = new Set(this.tools().map((tool) => tool.name));
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
      SOURCE,
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

  search(query: string, limit = 15): TalendResult {
    const max = Math.max(1, Math.min(limit, 50));
    const tools = this.tools()
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
      return errorResult(SOURCE, "NO_MATCHES", `Sin resultados para '${query}'.`, undefined, {
        nextActions: [{ label: "Ver todas las tareas", toolName: "talend_guide", input: { mode: "overview" } }],
      });
    }

    return okResult({ query, tools, tasks }, SOURCE, tools.length > 0 ? "high" : "medium");
  }

  describeTool(name: string, includeSchema = true): TalendResult {
    const normalized = normalize(name).startsWith("talend_") ? normalize(name) : normalize(`talend_${name}`);
    const raw = this.listTools().find((tool) => normalize(tool.name) === normalized);
    if (!raw) {
      const suggestions = this.tools()
        .map((tool) => ({ tool, score: scoreTool(tool, name) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.tool.name);
      return errorResult(SOURCE, "TOOL_NOT_FOUND", `No existe la tool '${name}'.`, { suggestions }, {
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
      SOURCE,
      "high",
    );
  }

  rules(taskId?: string): TalendResult {
    const selected = taskId
      ? GUIDE_RULES.filter((rule) => !rule.appliesTo || rule.appliesTo.includes(taskId))
      : GUIDE_RULES;
    return okResult(
      {
        count: selected.length,
        task: taskId ?? null,
        rules: selected.map((rule) => ({ id: rule.id, rule: rule.rule, detail: rule.detail })),
      },
      SOURCE,
      "high",
    );
  }

  async environment(): Promise<TalendResult> {
    const project = getConfiguredProjectPath() ?? null;
    const diagnostics: string[] = [];
    let bridge: Record<string, unknown> = { connected: false };

    try {
      const { createBridgeClient } = await import(
        "../../studio-bridge/adapters/http-studio-bridge.client"
      );
      const client = await createBridgeClient();
      const ping = await client.ping();
      const data = (ping.data ?? {}) as Record<string, unknown>;
      bridge = {
        connected: ping.ok,
        endpoint: client.getConfig().host + ":" + client.getConfig().port,
        ...(ping.ok
          ? {
              plugin: data.plugin,
              version: data.version,
              mode: data.mode,
              unsafeActions: data.unsafeActions,
            }
          : { error: ping.error?.message ?? "sin respuesta" }),
      };
    } catch (err) {
      bridge = {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (!project) {
      diagnostics.push(
        "No hay proyecto configurado. Define TALEND_PROJECT (la carpeta que contiene talend.project) o abre el proyecto en Studio.",
      );
    }
    if (bridge.connected !== true) {
      diagnostics.push(
        "El bridge de Studio no responde. Abre Talend Studio con el plugin instalado (`bun run scripts/start.ts --install-bridge`).",
      );
    }

    return okResult(
      {
        project,
        projectSource: process.env.TALEND_PROJECT ? "TALEND_PROJECT" : "autodeteccion",
        bridge,
        diagnostics,
      },
      SOURCE,
      project && bridge.connected === true ? "high" : "low",
      {
        nextActions: project
          ? [{ label: "Listar los jobs del proyecto", toolName: "talend_jobs_list", input: { limit: 20 } }]
          : [{ label: "Ver como configurar el entorno", toolName: "talend_guide", input: { mode: "task", task: "orientarse" } }],
      },
    );
  }
}
