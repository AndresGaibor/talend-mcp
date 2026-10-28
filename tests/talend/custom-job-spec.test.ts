import { expect, test } from "bun:test";
import { applyCustomJobSpec, type CustomSpecDependencies } from "../../src/talend/studio/apply-custom-job-spec";
import type { CustomJobSpec } from "../../src/talend/studio/custom-job-spec";

const ok = (result: unknown) => ({ ok: true, data: { result } });
function studio() {
  const jobs: Awaited<ReturnType<CustomSpecDependencies["listJobs"]>> = [];
  const nodes: Record<string, Array<Record<string, unknown>>> = {};
  const edges: Record<string, Array<Record<string, unknown>>> = {};
  const variables: Record<string, Array<Record<string, unknown>>> = {};
  const events: string[] = [];
  const editors: string[] = [];
  const openEditor = (name: string) => { const title = `Job ${name} 0.1`; if (!editors.includes(title)) editors.push(title); };
  let active = "";
  const bridge = {
    componentParameters: async () => ok({ parameters: [{ name: "HEADER", field: "TEXT" }] }),
    createJob: async (input: { name: string; folder: string; description: string; replace: boolean }) => {
      expect(input.replace).toBe(false);
      active = input.name; events.push(`create:${active}`); openEditor(active);
      jobs.push({ label: input.name, version: "0.1", folderPath: input.folder, description: input.description, itemPath: `workspace/process/${input.folder}/${input.name}_0.1.item`, propertiesPath: "properties" });
      nodes[active] = []; edges[active] = []; variables[active] = [];
      return ok({ jobName: input.name });
    },
    deleteJob: async (input: { name: string }) => {
      const index = jobs.findIndex((job) => job.label === input.name);
      if (index >= 0) jobs.splice(index, 1);
      events.push(`delete:${input.name}`);
      return ok({ deleted: true });
    },
    openJob: async (input: { name: string }) => { active = input.name; events.push(`open:${active}`); openEditor(active); return ok({ opened: true }); },
    workbenchState: async () => ({ ok: true, source: "studio-bridge", confidence: "high", data: { windows: [{ openEditors: editors.map((title) => ({ title, id: "org.talend.designer.core.ui.MultiPageTalendEditor", dirty: false })) }] } }),
    closeEditor: async (title: string) => { const i = editors.indexOf(title); if (i >= 0) editors.splice(i, 1); events.push(`close:${title}`); return { ok: true, source: "studio-bridge", confidence: "high", data: { closed: true } }; },
    listNodes: async () => ok(nodes[active] ?? []),
    activeJobModel: async () => ({ ok: true, data: { ok: true, components: nodes[active], connections: edges[active] } }),
    addNode: async (input: { type: string; label: string }) => {
      const uniqueName = `${input.type}_${nodes[active]!.length + 5}`;
      nodes[active]!.push({ uniqueName, componentName: input.type, label: input.label });
      events.push(`add:${active}`); return ok({ uniqueName, saved: true });
    },
    configureNode: async () => { events.push(`configure:${active}`); return ok({}); },
    connectNodes: async (input: Record<string, unknown>) => { edges[active]!.push({ ...input, connectorName: input.type }); events.push(`connect:${active}`); return ok({}); },
    jobContexts: async () => ok({ contexts: [{ name: "Default", parameters: variables[active] }] }),
    setJobContextParameter: async (input: Record<string, unknown>) => { variables[active]!.push(input); events.push(`context:${active}`); return ok({}); },
    deleteJobContextParameter: async () => { throw new Error("Este escenario no debe borrar contextos"); },
    createJobContext: async () => ok({}),
  };
  return { jobs, nodes, variables, events, editors, dependencies: {
    bridge: bridge as unknown as CustomSpecDependencies["bridge"], listJobs: async () => jobs,
    validateConnection: async () => ({ ok: true, errors: [], warnings: [] }),
  } satisfies CustomSpecDependencies };
}

test("rechaza una conexion incompatible antes de modificar Studio", async () => {
  const writes: string[] = [];
  const dependencies = {
    bridge: {
      componentParameters: async () => ({ ok: true, data: { result: { parameters: [] } } }),
      createJob: async () => { writes.push("create"); return { ok: true, data: {} }; },
    },
    listJobs: async () => [],
    validateConnection: async () => ({ ok: false, errors: ["FLOW no es una salida valida"], warnings: [] }),
  } as unknown as CustomSpecDependencies;
  await expect(applyCustomJobSpec({ jobName: "job_test", folderPath: "Process/test", components: [
    { uniqueName: "a", componentName: "tUniqRow" }, { uniqueName: "b", componentName: "tLogRow" },
  ], connections: [{ source: "a", target: "b", connectorName: "FLOW", label: "row1" }] }, dependencies)).rejects.toThrow("FLOW no es una salida valida");
  expect(writes).toEqual([]);
});

test("no reemplaza un Job ajeno aunque coincidan nombre y carpeta", async () => {
  const fake = studio();
  fake.jobs.push({ label: "job_existing", version: "0.1", folderPath: "test", description: "Creado por una persona", itemPath: "existing.item", propertiesPath: "existing.properties" });
  await expect(applyCustomJobSpec({ jobName: "job_existing", folderPath: "Process/test", components: [] }, fake.dependencies)).rejects.toThrow("CONFLICT");
  expect(fake.events).toEqual([]);
});

test("reutiliza un Job propio cuando la ruta de Talend incluye la subcarpeta del Job", async () => {
  const fake = studio();
  const spec: CustomJobSpec = {
    jobName: "job_test",
    folderPath: "Process/test",
    components: [{ uniqueName: "log_1", componentName: "tLogRow" }],
  };

  const first = await applyCustomJobSpec(spec, fake.dependencies) as Record<string, unknown>;
  expect(first["generatedComponents"]).toBe(1);

  fake.jobs[0]!.folderPath = "test/job_test";
  const second = await applyCustomJobSpec(spec, fake.dependencies) as Record<string, unknown>;

  expect(second["reusedExisting"]).toBe(true);
  expect(second["reusedComponents"]).toBe(1);
  expect(fake.events.filter((event) => event === "create:job_test")).toHaveLength(1);
});

test("valida los hijos antes del primer cambio y los crea antes del padre", async () => {
  const fake = studio();
  const spec: CustomJobSpec = { jobName: "job_parent", folderPath: "Process/test", components: [], childJobs: [{ jobName: "job_child", folderPath: "Process/test", components: [] }] };
  const result = await applyCustomJobSpec(spec, fake.dependencies) as { childJobs: unknown[] };
  expect(fake.events.filter((event) => event.startsWith("create:"))).toEqual(["create:job_child", "create:job_parent"]);
  expect(result.childJobs).toHaveLength(1);

  const invalid = studio();
  spec.childJobs![0]!.components.push({ uniqueName: "bad", componentName: "tLogRow", parameters: { INVENTADO: "x" } });
  await expect(applyCustomJobSpec(spec, invalid.dependencies)).rejects.toThrow("INVENTADO");
  expect(invalid.events).toEqual([]);
});

test("una respuesta con fallo interno no confirma una creacion", async () => {
  const fake = studio();
  fake.dependencies.bridge.createJob = async () => ({ ok: true, source: "studio-bridge", confidence: "high", endpoint: "create", data: { result: { ok: false, error: "No se pudo guardar" } } });
  await expect(applyCustomJobSpec({ jobName: "job_failed", components: [] }, fake.dependencies)).rejects.toThrow("No se pudo guardar");
});

test("crea por Studio, conecta antes de terminar la configuracion y reintenta sin pisar valores", async () => {
  const fake = studio();
  const spec: CustomJobSpec = { jobName: "job_test", folderPath: "Process/test", components: [
    { uniqueName: "read_1", componentName: "tFileInputDelimited", label: "Leer", schema: { name: "schema", columns: [{ name: "id", type: "id_Integer" }] } },
    { uniqueName: "out_1", componentName: "tLogRow", label: "Salida" },
  ], connections: [{ source: "read_1", target: "out_1", connectorName: "FLOW", label: "row1" }], contexts: [{ name: "folder", type: "id_String", value: "", comment: "Completar ruta" }] };
  const first = await applyCustomJobSpec(spec, fake.dependencies) as Record<string, unknown>;
  expect(first["generatedComponents"]).toBe(2);
  expect(fake.events.indexOf("configure:job_test")).toBeGreaterThan(fake.events.indexOf("connect:job_test"));
  fake.variables["job_test"]![0]!["value"] = "ruta_revisada_por_usuario";
  const second = await applyCustomJobSpec(spec, fake.dependencies) as Record<string, unknown>;
  expect(second["generatedComponents"]).toBe(0);
  expect(second["reusedComponents"]).toBe(2);
  expect(second["reusedConnections"]).toBe(1);
  expect(fake.variables["job_test"]![0]!["value"]).toBe("ruta_revisada_por_usuario");
  expect(fake.events.filter((event) => event.startsWith("create:"))).toHaveLength(1);
});

test("omite un borrador ausente en Studio y conserva el pendiente en el contexto", async () => {
  const fake = studio();
  fake.dependencies.bridge.componentParameters = async ({ name }) => {
    if (name === "tDBRow") {
      return {
        ok: true,
        source: "studio-bridge",
        confidence: "medium",
        endpoint: "/automation/components/parameters",
        data: { ok: false, error: "OPERATION_FAILED: Componente 'tDBRow' no encontrado en el catalogo de Talend" },
      };
    }
    return {
      ok: true,
      source: "studio-bridge",
      confidence: "medium",
      endpoint: "/automation/components/parameters",
      data: { result: { parameters: [{ name: "HEADER", field: "TEXT" }] } },
    };
  };

  const result = await applyCustomJobSpec({
    jobName: "job_with_unavailable_draft",
    folderPath: "Process/test",
    components: [
      { uniqueName: "source", componentName: "tFileInputDelimited" },
      { uniqueName: "maintenance", componentName: "tDBRow", draftOnly: true, draftReason: "Confirmar mantenimiento SQL" },
      { uniqueName: "sink", componentName: "tLogRow" },
    ],
    connections: [
      { source: "source", target: "maintenance", connectorName: "FLOW", label: "rows_in" },
      { source: "maintenance", target: "sink", connectorName: "FLOW", label: "rows_out" },
    ],
    contexts: [{ name: "migration_todo_123456789abc", type: "id_String", value: "", comment: "Confirmar mantenimiento SQL antes de usar el Job." }],
  }, fake.dependencies);

  expect(fake.nodes["job_with_unavailable_draft"]?.map((node) => node.componentName)).toEqual([
    "tFileInputDelimited", "tLogRow",
  ]);
  expect(result.generatedComponents).toBe(2);
  expect(result.generatedConnections).toBe(0);
  expect(result.warnings.join(" ")).toContain("tDBRow");
  expect(result.warnings.join(" ")).toContain("no se creó");
  expect(fake.variables["job_with_unavailable_draft"]?.[0]?.comment).toContain("Confirmar mantenimiento SQL");
});

test("no conecta desde un tMap sin mapeo: Studio no tiene tabla de salida y la conexion fallaria a medias", async () => {
  const fake = studio();

  const result = await applyCustomJobSpec({
    jobName: "job_with_mapperless_tmap",
    folderPath: "Process/test",
    components: [
      { uniqueName: "map_1", componentName: "tMap", draftOnly: true, draftReason: "Falta el esquema de entrada" },
      { uniqueName: "filter_2", componentName: "tFilterRow", draftOnly: true, draftReason: "Falta el filtro" },
    ],
    connections: [{ source: "map_1", target: "filter_2", connectorName: "FLOW", label: "row_3_1" }],
  }, fake.dependencies);

  expect(result.generatedComponents).toBe(2);
  expect(result.generatedConnections).toBe(0);
  expect(fake.events.filter((event) => event.startsWith("connect:"))).toHaveLength(0);
  expect(result.warnings.join(" ")).toContain("map_1 → filter_2");
  expect(result.warnings.join(" ")).toContain("no se creó");
  expect(result.warnings.join(" ")).toContain("tMap");
});

test("un tMap con mapeo si se conecta", async () => {
  const fake = studio();

  const result = await applyCustomJobSpec({
    jobName: "job_with_configured_tmap",
    folderPath: "Process/test",
    components: [
      { uniqueName: "map_1", componentName: "tMap", mapper: { inputs: [], outputs: [{ name: "row_3_1", columns: [] }] } },
      { uniqueName: "out_2", componentName: "tLogRow" },
    ],
    connections: [{ source: "map_1", target: "out_2", connectorName: "FLOW", label: "row_3_1" }],
  }, fake.dependencies);

  expect(result.generatedConnections).toBe(1);
});

test("si la aplicacion falla a mitad, revierte los Jobs que creo y lo dice en el error", async () => {
  const fake = studio();
  fake.dependencies.bridge.connectNodes = async () => { throw new Error("Studio rechazo la conexion"); };

  const spec: CustomJobSpec = {
    jobName: "job_padre",
    folderPath: "Process/test",
    components: [{ uniqueName: "a_1", componentName: "tFileInputDelimited" }, { uniqueName: "b_2", componentName: "tLogRow" }],
    connections: [{ source: "a_1", target: "b_2", connectorName: "FLOW", label: "row1" }],
    childJobs: [{ jobName: "job_hijo", folderPath: "Process/test", components: [{ uniqueName: "c_1", componentName: "tLogRow" }] }],
  };

  await expect(applyCustomJobSpec(spec, fake.dependencies)).rejects.toThrow(/Studio rechazo la conexion.*revirti.*job_padre.*job_hijo/s);
  expect(fake.jobs).toEqual([]);
  expect(fake.events.filter((event) => event.startsWith("delete:"))).toEqual(["delete:job_padre", "delete:job_hijo"]);
});

test("no borra un Job que ya existia antes de la llamada", async () => {
  const fake = studio();
  const child: CustomJobSpec = { jobName: "job_hijo", folderPath: "Process/test", components: [{ uniqueName: "c_1", componentName: "tLogRow" }] };
  await applyCustomJobSpec(child, fake.dependencies);
  fake.dependencies.bridge.connectNodes = async () => { throw new Error("Studio rechazo la conexion"); };

  await expect(applyCustomJobSpec({
    jobName: "job_padre",
    folderPath: "Process/test",
    components: [{ uniqueName: "a_1", componentName: "tFileInputDelimited" }, { uniqueName: "b_2", componentName: "tLogRow" }],
    connections: [{ source: "a_1", target: "b_2", connectorName: "FLOW", label: "row1" }],
    childJobs: [child],
  }, fake.dependencies)).rejects.toThrow(/Studio rechazo la conexion.*revirti.*job_padre/s);

  expect(fake.jobs.map((job) => job.label)).toEqual(["job_hijo"]);
  expect(fake.events.filter((event) => event.startsWith("delete:"))).toEqual(["delete:job_padre"]);
});

test("si no puede borrar lo creado, avisa de que hay que revisarlo en Studio", async () => {
  const fake = studio();
  fake.dependencies.bridge.connectNodes = async () => { throw new Error("Studio rechazo la conexion"); };
  fake.dependencies.bridge.deleteJob = async () => { throw new Error("Studio ocupado"); };

  await expect(applyCustomJobSpec({
    jobName: "job_huerfano",
    folderPath: "Process/test",
    components: [{ uniqueName: "a_1", componentName: "tFileInputDelimited" }, { uniqueName: "b_2", componentName: "tLogRow" }],
    connections: [{ source: "a_1", target: "b_2", connectorName: "FLOW", label: "row1" }],
  }, fake.dependencies)).rejects.toThrow(/Studio rechazo la conexion.*revisarse en Studio.*job_huerfano/s);
});

test("cierra el editor que abrio la aplicacion: acumulados, saturan el hilo de interfaz de Studio", async () => {
  const fake = studio();

  await applyCustomJobSpec({
    jobName: "job_cierra_editor",
    folderPath: "Process/test",
    components: [{ uniqueName: "a_1", componentName: "tLogRow" }],
  }, fake.dependencies);

  expect(fake.editors).toEqual([]);
  expect(fake.events).toContain("close:Job job_cierra_editor 0.1");
});

test("no cierra un editor que la persona ya tenia abierto", async () => {
  const fake = studio();
  const spec: CustomJobSpec = { jobName: "job_abierto", folderPath: "Process/test", components: [{ uniqueName: "a_1", componentName: "tLogRow" }] };
  await applyCustomJobSpec(spec, fake.dependencies);
  fake.editors.push("Job job_abierto 0.1");
  fake.events.length = 0;

  await applyCustomJobSpec(spec, fake.dependencies);

  expect(fake.editors).toEqual(["Job job_abierto 0.1"]);
  expect(fake.events.filter((event) => event.startsWith("close:"))).toEqual([]);
});
