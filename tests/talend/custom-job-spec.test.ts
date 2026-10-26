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
  let active = "";
  const bridge = {
    componentParameters: async () => ok({ parameters: [{ name: "HEADER", field: "TEXT" }] }),
    createJob: async (input: { name: string; folder: string; description: string; replace: boolean }) => {
      expect(input.replace).toBe(false);
      active = input.name; events.push(`create:${active}`);
      jobs.push({ label: input.name, version: "0.1", folderPath: input.folder, description: input.description, itemPath: `workspace/process/${input.folder}/${input.name}_0.1.item`, propertiesPath: "properties" });
      nodes[active] = []; edges[active] = []; variables[active] = [];
      return ok({ jobName: input.name });
    },
    openJob: async (input: { name: string }) => { active = input.name; events.push(`open:${active}`); return ok({ opened: true }); },
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
  return { jobs, nodes, variables, events, dependencies: {
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
