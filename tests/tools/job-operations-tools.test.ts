import { test, expect, describe } from "bun:test";
import { jobOperationsTools } from "../../src/talend/studio/tools-job-operations";

/**
 * Contrato de las tools que operan sobre el job abierto en Talend Studio.
 *
 * Comprueban lo que no se puede ver en ejecucion: que las tools existen, que
 * tienen los parametros que el bridge espera y que no se repiten.
 */
describe("Tools de operaciones sobre el job de Studio", () => {
  const byName = new Map(jobOperationsTools.map((tool) => [tool.name, tool]));

  describe("1. Catalogo", () => {
    test("expone las tools del ciclo de vida del job", () => {
      const esperadas = [
        "talend_job_create_in_studio",
        "talend_job_delete_in_studio",
        "talend_job_open_in_studio",
        "talend_job_add_node",
        "talend_job_configure_node",
        "talend_job_connect_nodes",
        "talend_job_update_node",
        "talend_job_set_schema",
        "talend_job_list_nodes",
        "talend_job_problems",
        "talend_job_compile",
        "talend_studio_run_code",
        "talend_studio_dismiss_dialogs",
        "talend_studio_ui_inventory",
        "talend_studio_ui_dialogs",
        "talend_studio_list_components",
        "talend_studio_component_parameters",
      ];
      for (const nombre of esperadas) {
        expect(byName.has(nombre), `Falta la tool ${nombre}`).toBe(true);
      }
    });

    test("no repite nombres", () => {
      const nombres = jobOperationsTools.map((tool) => tool.name);
      expect(new Set(nombres).size).toBe(nombres.length);
    });

    test("todas tienen descripcion", () => {
      for (const tool of jobOperationsTools) {
        expect(typeof tool.description).toBe("string");
        expect((tool.description ?? "").length).toBeGreaterThan(10);
      }
    });
  });

  describe("2. Parametros que espera el bridge", () => {
    test("crear job admite replace para no chocar con la etiqueta", () => {
      const tool = byName.get("talend_job_create_in_studio");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      expect(forma?.shape).toBeDefined();
      expect(Object.keys(forma?.shape ?? {})).toContain("replace");
      expect(Object.keys(forma?.shape ?? {})).toContain("name");
    });

    test("borrar job pide el nombre", () => {
      const tool = byName.get("talend_job_delete_in_studio");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      expect(Object.keys(forma?.shape ?? {})).toContain("name");
    });

    test("abrir job admite la ruta exacta relativa al proyecto", () => {
      const tool = byName.get("talend_job_open_in_studio");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      expect(Object.keys(forma?.shape ?? {})).toContain("itemPath");
      expect(tool?.inputSchema.safeParse({
        name: "CargaSAS",
        version: "0.1",
        itemPath: "process/PruebasWebSAS/CargaSAS/CargaSAS_0.1.item",
      }).success).toBe(true);
    });

    test("conectar pide origen y destino", () => {
      const tool = byName.get("talend_job_connect_nodes");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      const claves = Object.keys(forma?.shape ?? {});
      expect(claves).toContain("source");
      expect(claves).toContain("target");
      expect(claves).toContain("job");
    });

    test("definir schema admite columnas y valores", () => {
      const tool = byName.get("talend_job_set_schema");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      const claves = Object.keys(forma?.shape ?? {});
      expect(claves).toContain("columns");
      expect(claves).toContain("values");
      expect(claves).toContain("uniqueName");
    });

    test("reemplazar pendientes solo admite borrar marcadores administrados", () => {
      const tool = byName.get("talend_job_add_context_parameters");
      const forma = tool?.inputSchema as { shape?: Record<string, unknown> } | undefined;
      expect(Object.keys(forma?.shape ?? {})).toContain("removeManagedTodoNames");
      expect(tool?.inputSchema.safeParse({
        job: "job_daily",
        contexts: [],
        removeManagedTodoNames: ["migration_todo_old"],
      }).success).toBe(true);
      expect(tool?.inputSchema.safeParse({
        job: "job_daily",
        contexts: [],
        removeManagedTodoNames: ["CURR_DT"],
      }).success).toBe(false);
    });

    test("anadir y configurar un nodo admiten la configuracion declarativa", () => {
      for (const nombre of ["talend_job_add_node", "talend_job_configure_node"]) {
        const forma = byName.get(nombre)?.inputSchema as { shape?: Record<string, unknown> } | undefined;
        const claves = Object.keys(forma?.shape ?? {});
        expect(claves, `${nombre} sin parameters`).toContain("parameters");
        expect(claves, `${nombre} sin tables`).toContain("tables");
        expect(claves, `${nombre} sin schema`).toContain("schema");
        expect(claves, `${nombre} sin mapper`).toContain("mapper");
      }
      const addNode = byName.get("talend_job_add_node")?.inputSchema as
        | { shape?: Record<string, unknown> }
        | undefined;
      expect(Object.keys(addNode?.shape ?? {})).toContain("job");
    });

    test("consultar el catalogo pide el nombre del componente", () => {
      const forma = byName.get("talend_studio_component_parameters")?.inputSchema as
        | { shape?: Record<string, unknown> }
        | undefined;
      expect(Object.keys(forma?.shape ?? {})).toContain("name");
    });
  });
});
