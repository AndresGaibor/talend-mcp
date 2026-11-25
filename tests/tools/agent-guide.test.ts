import { afterEach, describe, expect, test } from "bun:test";
import { createAgentGuideTool } from "../../src/modules/guide/tools/agent-guide.tool";
import { GUIDE_RULES, GUIDE_TASKS } from "../../src/modules/guide/domain/task-catalog";
import { buildServerInstructions } from "../../src/modules/guide/domain/server-instructions";
import { getAllRuntimeTools, getRuntimeTools } from "../../src/server/registered-tools";

const originalFilter = process.env.TALEND_MCP_FILTER;

afterEach(() => {
  if (originalFilter === undefined) delete process.env.TALEND_MCP_FILTER;
  else process.env.TALEND_MCP_FILTER = originalFilter;
});

describe("Guia para agentes", () => {
  test("cada tool que aparece en una tarea existe y cada ejemplo respeta su schema", () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tools = new Map(getAllRuntimeTools().map((tool) => [tool.name, tool]));

    for (const task of GUIDE_TASKS) {
      for (const step of task.steps) {
        const tool = tools.get(step.tool);
        expect(tool, `${task.id} apunta a una tool inexistente: ${step.tool}`).toBeDefined();
        if (!step.input) continue;

        const schema = tool!.inputSchema as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        const properties = schema.properties ?? {};
        const unknown = Object.keys(step.input).filter((key) => !(key in properties));
        const missing = (schema.required ?? []).filter((key) => !(key in step.input!));

        expect(unknown, `${step.tool} tiene argumentos no declarados: ${unknown.join(", ")}`).toEqual([]);
        expect(missing, `${step.tool} necesita argumentos ausentes: ${missing.join(", ")}`).toEqual([]);
      }
    }
  });

  test("overview es el punto de entrada y recomienda la siguiente accion", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const result = await tool.handler({ mode: "overview" });
    const structured = result.structuredContent as {
      ok: boolean;
      data: { toolCount: number; tasks: Array<{ id: string }>; areas: unknown[] };
      nextActions: Array<{ toolName: string }>;
    };

    expect(structured.ok).toBe(true);
    expect(structured.data.toolCount).toBeGreaterThan(200);
    expect(structured.data.tasks.map((task) => task.id)).toContain("crear-job");
    expect(structured.data.areas.length).toBeGreaterThan(5);
    expect(structured.nextActions[0]?.toolName).toBe("talend_guide");
  });

  test("task busca por lenguaje natural y expone los pasos en orden", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const result = await tool.handler({ mode: "task", task: "quiero crear un job nuevo" });
    const structured = result.structuredContent as {
      ok: boolean;
      data: { id: string; steps: Array<{ tool: string }> };
    };

    expect(structured.ok).toBe(true);
    expect(structured.data.id).toBe("crear-job");
    expect(structured.data.steps[0]?.tool).toBe("talend_studio_list_components");
    expect(structured.data.steps.at(-1)?.tool).toBe("talend_job_execute");
  });

  test("search encuentra tools por texto con y sin tildes", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const result = await tool.handler({ mode: "search", query: "conexion de base de datos" });
    const structured = result.structuredContent as {
      ok: boolean;
      data: { tools: Array<{ name: string }> };
    };

    expect(structured.ok).toBe(true);
    expect(structured.data.tools.some((item) => item.name === "talend_connection_build_profile")).toBe(true);
  });

  test("tools mode detalla schemas y requisitos de Studio", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const result = await tool.handler({ mode: "tool", tool: "job_add_node" });
    const structured = result.structuredContent as {
      ok: boolean;
      data: { name: string; requiresStudio: boolean; inputSchema: { properties: Record<string, unknown> } };
    };

    expect(structured.ok).toBe(true);
    expect(structured.data.name).toBe("talend_job_add_node");
    expect(structured.data.requiresStudio).toBe(true);
    expect(structured.data.inputSchema.properties).toHaveProperty("type");
  });

  test("distingue tools en vivo de las tools que solo operan sobre la especificacion", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const live = await tool.handler({ mode: "tool", tool: "talend_job_add_node" });
    const offline = await tool.handler({ mode: "tool", tool: "talend_job_generate_from_pipeline_spec" });
    const liveData = live.structuredContent as { data: { requiresStudio: boolean } };
    const offlineData = offline.structuredContent as { data: { requiresStudio: boolean } };

    expect(liveData.data.requiresStudio).toBe(true);
    expect(offlineData.data.requiresStudio).toBe(false);
  });

  test("la tool de guia se conserva aun con presets reducidos", () => {
    process.env.TALEND_MCP_FILTER = "core";
    expect(getRuntimeTools().map((tool) => tool.definition.name)).toContain("talend_guide");
  });

  test("el preset agent reduce el catalogo y conserva el ciclo de vida de un job", () => {
    process.env.TALEND_MCP_FILTER = "all";
    const allCount = getRuntimeTools().length;
    process.env.TALEND_MCP_FILTER = "agent";
    const names = new Set(getRuntimeTools().map((tool) => tool.definition.name));

    expect(names.size).toBeLessThan(allCount);
    expect(names).toContain("talend_guide");
    expect(names).toContain("talend_job_create_in_studio");
    expect(names).toContain("talend_job_verify");
    expect(names).not.toContain("talend_job_run_by_name");
    expect(names).toContain("talend_job_execute");
    expect(names).not.toContain("talend_snapshots_restore");
  });

  test("las instrucciones del servidor dirigen al agente al punto de entrada", () => {
    const instructions = buildServerInstructions();
    expect(instructions).toContain("talend_guide { mode: \"overview\" }");
    expect(instructions).toContain("ESTRATEGIA MIXTA");
    expect(instructions).toContain("talend_job_verify");
  });

  test("las reglas de criterio profesional existen y aplican al diseno de jobs", () => {
    const ids = [
      "inventario-primero", "reutilizar-antes-de-crear", "contexto-de-proyecto",
      "conexion-de-repositorio", "nombres-del-proyecto", "un-job-una-responsabilidad",
      "logica-comun-en-hijo", "control-de-errores", "sin-componentes-huerfanos",
      "esquemas-explicitos", "preguntar-huecos", "contextos-por-entorno",
      "cambios-minimos-en-existentes", "etiquetas-con-sentido",
    ];
    for (const id of ids) {
      const rule = GUIDE_RULES.find((r) => r.id === id);
      expect(rule, `falta la regla ${id}`).toBeDefined();
      expect(rule!.detail.length).toBeGreaterThan(40);
      if (id === "contextos-por-entorno") {
        // Regla preexistente sin appliesTo: aplica a todas las tareas.
        expect(rule!.appliesTo === undefined || rule!.appliesTo.includes("disenar-job")).toBe(true);
      } else {
        expect(rule!.appliesTo).toContain("disenar-job");
      }
    }
  });

  test("disenar-job se encuentra por lenguaje natural y empieza por el inventario", async () => {
    process.env.TALEND_MCP_FILTER = "all";
    const tool = createAgentGuideTool({ listTools: getAllRuntimeTools });
    const result = await tool.handler({ mode: "task", task: "quiero diseñar un job reutilizando lo que hay" });
    const structured = result.structuredContent as { ok: boolean; data: { id: string; steps: Array<{ tool: string }> } };

    expect(structured.ok).toBe(true);
    expect(structured.data.id).toBe("disenar-job");
    expect(structured.data.steps[0]?.tool).toBe("talend_project_profile");
    expect(structured.data.steps.at(-1)?.tool).toBe("talend_job_verify");
  });
});

test("disenar-job no llama a talend_list_project_contexts y deja jobs_list como respaldo", () => {
  const task = GUIDE_TASKS.find((t) => t.id === "disenar-job");
  expect(task).toBeDefined();
  expect(task!.steps.map((s) => s.tool)).not.toContain("talend_list_project_contexts");
  const listStep = task!.steps.find((s) => s.tool === "talend_jobs_list");
  expect(listStep?.optional).toBe(true);
  expect(listStep?.purpose).toMatch(/FALLBACK/);
  expect(task!.pitfalls).toContain("Las convenciones se deducen de los nombres existentes: si dudas de una, confirmala con el usuario antes de copiarla.");
});
