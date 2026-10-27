import { describe, expect, test } from "bun:test";
import { executeCustomSpec, type CustomSpecBridge, type CustomSpecInput } from "../../src/talend/studio/custom-spec-executor";

const baseSpec: CustomSpecInput = {
  jobName: "CustomerLoad",
  version: "0.1",
  folderPath: "Process/PruebasWebSAS",
  components: [
    {
      uniqueName: "tFileInputDelimited_1",
      componentName: "tFileInputDelimited",
      label: "Leer clientes",
      parameters: { FILENAME: "clients.csv" },
      posX: 160,
      posY: 96,
    },
    {
      uniqueName: "tLogRow_2",
      componentName: "tLogRow",
      label: "Mostrar clientes",
      parameters: {},
      posX: 440,
      posY: 96,
    },
  ],
  connections: [
    { source: "tFileInputDelimited_1", target: "tLogRow_2", label: "row1", connectorName: "FLOW" },
  ],
  contexts: [{ name: "input_path", type: "id_String", value: "", comment: "Ruta de entrada" }],
  instructions: { source: { program: "daily.sas" }, unresolved: ["schema"] },
};

function success(result: unknown) {
  return { ok: true, source: "studio-bridge" as const, confidence: "high" as const, endpoint: "/test", data: { ok: true as const, result } };
}

function createBridge(overrides: Partial<CustomSpecBridge> = {}, calls: string[] = []): CustomSpecBridge {
  return {
    listComponents: async (options) => {
      calls.push(`listComponents:${options?.filter}`);
      return success({ components: [options?.filter] });
    },
    componentParameters: async ({ name }) => {
      calls.push(`componentParameters:${name}`);
      return success({ name, parameters: [{ name: "FILENAME", required: false, show: true }] });
    },
    createJob: async () => {
      calls.push("createJob");
      return success({ created: true });
    },
    openJob: async (options) => {
      calls.push(`openJob:${options.itemPath ?? ""}`);
      return success({ opened: true });
    },
    listNodes: async () => {
      calls.push("listNodes");
      return success([]);
    },
    addContextParameters: async () => {
      calls.push("addContextParameters");
      return success({ saved: true });
    },
    jobContexts: async () => {
      calls.push("jobContexts");
      return success({ contexts: [{ name: "Default", isDefault: true, parameters: [] }] });
    },
    setJobContextParameter: async (options) => {
      calls.push(`setJobContextParameter:${options.context}:${options.name}:${options.value}`);
      return success({ created: false });
    },
    addNode: async (options) => {
      calls.push(`addNode:${options.type}`);
      return success({ uniqueName: `${options.type}_studio`, saved: true });
    },
    configureNode: async (options) => {
      calls.push(`configureNode:${options.uniqueName}`);
      return success({ saved: true });
    },
    updateNode: async (options) => {
      calls.push(`updateNode:${options.uniqueName}:${options.label ?? ""}`);
      return success({ saved: true });
    },
    connectNodes: async () => {
      calls.push("connectNodes");
      return success({ saved: true });
    },
    disconnectNodes: async (options) => {
      calls.push(`disconnectNodes:${options.source}:${options.target}:${options.name}`);
      return success({ removed: true, count: 1 });
    },
    activeJobModel: async () => {
      calls.push("activeJobModel");
      return success({ job: { label: "CustomerLoad", version: "0.1" }, connections: [] });
    },
    deleteJob: async () => {
      calls.push("deleteJob");
      return success({ deleted: true });
    },
    ...overrides,
  } as CustomSpecBridge;
}

describe("ejecutor de especificaciones del portal", () => {
  test("rechaza componentes ausentes del catálogo antes de crear o modificar un Job", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      listComponents: async () => {
        calls.push("listComponents");
        return success({ components: ["tLogRow"] });
      },
    }, calls);

    await expect(executeCustomSpec({ ...baseSpec, components: [baseSpec.components[0]!], connections: [], contexts: [] }, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] }))
      .rejects.toThrow("tFileInputDelimited");
    expect(calls).toEqual(["listComponents"]);
  });

  test("aplica propiedades verificadas de un componente borrador sin rellenar datos faltantes", async () => {
    let nodeReads = 0;
    let addedParameters: Parameters<CustomSpecBridge["addNode"]>[0]["parameters"];
    const bridge = createBridge({
      listNodes: async () => {
        nodeReads++;
        return success(nodeReads === 1 ? [] : [
          { uniqueName: "tFileInputDelimited_studio", componentName: "tFileInputDelimited", label: "Leer clientes" },
        ]);
      },
      addNode: async (options) => {
        addedParameters = options.parameters;
        return success({ uniqueName: "tFileInputDelimited_studio", saved: true });
      },
    });

    await executeCustomSpec({
      ...baseSpec,
      components: [{
        ...baseSpec.components[0]!,
        parameters: { FILENAME: "context.input_path" },
        draftOnly: true,
        draftReason: "El archivo de origen está pendiente de confirmar",
      }],
      connections: [],
      contexts: [{ name: "input_path", type: "id_String", value: "", comment: "Ruta pendiente" }],
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(addedParameters).toEqual({ FILENAME: { value: "context.input_path" } });
  });

  test("crea el Job, contextos, nodos y conexiones usando Studio en orden y verifica el resultado", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      listNodes: async () => {
        calls.push("listNodes");
        if (calls.filter((call) => call === "listNodes").length === 1) return success([]);
        return success([
          { uniqueName: "tFileInputDelimited_studio", componentName: "tFileInputDelimited", label: "Leer clientes" },
          { uniqueName: "tLogRow_studio", componentName: "tLogRow", label: "Mostrar clientes" },
        ]);
      },
    }, calls);

    const result = await executeCustomSpec(baseSpec, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(calls.indexOf("createJob")).toBeGreaterThan(calls.indexOf("componentParameters:tLogRow"));
    expect(calls).toContain("addContextParameters");
    expect(calls).toContain("addNode:tFileInputDelimited");
    expect(calls).toContain("addNode:tLogRow");
    expect(calls).toContain("connectNodes");
    expect(calls.at(-1)).toBe("listNodes");
    expect(calls.some((call) => /run|execute/i.test(call))).toBe(false);
    expect(result.generatedComponents).toBe(2);
    expect(result.connections).toBe(1);
  });

  test("prepara metadata vacio antes de conectar un flujo sin esquema confirmado", async () => {
    const calls: string[] = [];
    const spec: CustomSpecInput = {
      ...baseSpec,
      components: [
        { uniqueName: "tTeradataInput_1", componentName: "tTeradataInput", label: "Origen pendiente" },
        { uniqueName: "tMap_2", componentName: "tMap", label: "Transformación pendiente" },
      ],
      connections: [{
        source: "tTeradataInput_1",
        target: "tMap_2",
        label: "row1",
        connectorName: "FLOW",
      }],
      contexts: [{ name: "migration_todo_schema", type: "id_String", value: "", comment: "Definir esquema" }],
    };
    let nodeReads = 0;
    const bridge = createBridge({
      listNodes: async () => {
        nodeReads++;
        calls.push("listNodes");
        return success(nodeReads === 1 ? [] : [
          { uniqueName: "tTeradataInput_studio", componentName: "tTeradataInput", label: "Origen pendiente" },
          { uniqueName: "tMap_studio", componentName: "tMap", label: "Transformación pendiente" },
        ]);
      },
      connectNodes: async () => {
        calls.push("connectNodes");
        return success({ saved: true });
      },
      configureNode: async (options) => {
        calls.push(`configureNode:${options.uniqueName}:${options.schema ? "schema" : "parameters"}`);
        return success({ saved: true });
      },
    }, calls);

    await executeCustomSpec(spec, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(calls.indexOf("configureNode:tTeradataInput_studio:schema")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("configureNode:tTeradataInput_studio:schema")).toBeLessThan(calls.indexOf("connectNodes"));
  });

  test("tMap usa un valor admitido por Studio para el estilo de enlaces", async () => {
    let addedParameters: Parameters<CustomSpecBridge["addNode"]>[0]["parameters"];
    let nodeReads = 0;
    const bridge = createBridge({
      componentParameters: async ({ name }) => success({
        name,
        parameters: name === "tMap" ? [{
          name: "LINK_STYLE",
          field: "CLOSED_LIST",
          default: "",
          columns: ["AUTO", "BEZIER_CURVE", "LINE"],
        }] : [],
      }),
      listNodes: async () => {
        nodeReads++;
        return success(nodeReads === 1 ? [] : [{
          uniqueName: "tMap_studio",
          componentName: "tMap",
          label: "Transformación pendiente",
        }]);
      },
      addNode: async (options) => {
        addedParameters = options.parameters;
        return success({ uniqueName: "tMap_studio", saved: true });
      },
      activeJobModel: async () => success({ job: { label: "MapDraft", version: "0.1" }, connections: [] }),
    });
    const spec: CustomSpecInput = {
      ...baseSpec,
      jobName: "MapDraft",
      components: [{
        uniqueName: "tMap_1",
        componentName: "tMap",
        label: "Transformación pendiente",
        parameters: {},
      }],
      connections: [],
      contexts: [],
    };

    await executeCustomSpec(spec, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(addedParameters).toEqual({ LINK_STYLE: { value: "AUTO" } });
  });

  test("reemplaza solo los marcadores vacíos de pendientes creados por el portal", async () => {
    let addOptions: Parameters<CustomSpecBridge["addContextParameters"]>[0] | undefined;
    const bridge = createBridge({
      jobContexts: async () => success({ contexts: [{
        name: "Default",
        isDefault: true,
        parameters: [
          {
            name: "migration_todo_old",
            type: "id_String",
            value: "",
            comment: "Información técnica pendiente del portal: detalle previo",
          },
          {
            name: "migration_todo_filled",
            type: "id_String",
            value: "dato confirmado",
            comment: "Información técnica pendiente del portal: completar luego",
          },
        ],
      }] }),
      addContextParameters: async (options) => {
        addOptions = options;
        return success({ saved: true });
      },
      activeJobModel: async () => success({ job: { label: "ContextCleanup", version: "0.1" }, connections: [] }),
    });

    await executeCustomSpec({
      ...baseSpec,
      jobName: "ContextCleanup",
      components: [],
      connections: [],
      contexts: [{
        name: "migration_todo_current",
        type: "id_String",
        value: "",
        comment: "Información técnica pendiente del portal (step:read):\n- detalle actual",
      }],
      replaceManagedTodoContexts: true,
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(addOptions?.contexts.map((context) => context.name)).toEqual(["migration_todo_current"]);
    expect(addOptions?.removeManagedTodoNames).toEqual(["migration_todo_old"]);
  });

  test("crea los Jobs hijos antes del orquestador y configura el tRunJob con contexto del hijo", async () => {
    const calls: string[] = [];
    let activeJobName = "";
    const nodesByJob = new Map<string, Array<Record<string, unknown>>>();
    const childSpec = {
      jobName: "job_claims_processing",
      version: "0.1",
      defaultContext: "Default",
      folderPath: "Process/PruebasWebSAS/ts-sas-legacy-analytics/Programs/Insurance",
      components: [],
      connections: [],
      contexts: [{ name: "proc_date", type: "id_String", value: "", comment: "Fecha pendiente" }],
      instructions: { source: { program: "ts-sas-legacy-analytics/Programs/Insurance/claims_processing.sas" } },
    };
    const parentSpec = {
      ...baseSpec,
      jobName: "job_run_daily_insurance",
      components: [{
        uniqueName: "tRunJob_1",
        componentName: "tRunJob",
        label: "Ejecutar claims_processing [run_step_1]",
        parameters: { PROCESS: "job_claims_processing" },
        tables: {
          CONTEXTPARAMS: {
            columns: ["PARAM_NAME_COLUMN", "PARAM_VALUE_COLUMN"],
            rows: [["proc_date", "context.CURR_DT"]],
          },
        },
      }],
      connections: [],
      contexts: [{ name: "CURR_DT", type: "id_String", value: "", comment: "Fecha pendiente" }],
      instructions: { source: { program: "ts-sas-legacy-analytics/BatchJobs/run_daily_insurance.sas" } },
      childJobs: [childSpec],
    } as CustomSpecInput;
    const bridge = createBridge({
      createJob: async (options) => {
        activeJobName = options.name;
        calls.push(`createJob:${options.name}`);
        return success({ created: true });
      },
      activeJobModel: async () => success({ job: { label: activeJobName, version: "0.1" }, connections: [] }),
      listNodes: async () => success(nodesByJob.get(activeJobName) ?? []),
      componentParameters: async ({ name }) => success({
        name,
        parameters: name === "tRunJob"
          ? [{ name: "PROCESS", field: "PROCESS_TYPE", required: true, show: true }]
          : [],
      }),
      addNode: async (options) => {
        const node = { uniqueName: `${options.type}_studio`, componentName: options.type, label: options.label };
        nodesByJob.set(activeJobName, [...(nodesByJob.get(activeJobName) ?? []), node]);
        calls.push(`addNode:${activeJobName}:${options.type}`);
        return success({ uniqueName: node.uniqueName, saved: true });
      },
      configureNode: async (options) => {
        calls.push(`configureNode:${activeJobName}:${options.uniqueName}`);
        return success({ saved: true });
      },
    }, calls);

    const result = await executeCustomSpec(parentSpec, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => [],
    });

    expect(calls.indexOf("createJob:job_claims_processing")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("createJob:job_claims_processing")).toBeLessThan(calls.indexOf("createJob:job_run_daily_insurance"));
    expect(calls).toContain("addNode:job_run_daily_insurance:tRunJob");
    expect(result.childJobs).toHaveLength(1);
    expect(result.childJobs[0]?.jobName).toBe("job_claims_processing");
  });

  test("alinea los esquemas y el mapper con los nombres reales de Studio después de conectar", async () => {
    const calls: string[] = [];
    const configured: Array<{ uniqueName: string; schema?: Array<{ name: string }>; mapper?: Record<string, unknown> }> = [];
    let connected = false;
    const spec: CustomSpecInput = {
      ...baseSpec,
      contexts: [],
      instructions: { source: { program: "synthetic.sas" }, executionMode: { kind: "synthetic_test_data" } },
      components: [
        {
          uniqueName: "fixture_source",
          componentName: "tFixedFlowInput",
          label: "Datos de prueba",
          schema: { name: "fixture_source_schema", columns: [{ name: "id", type: "id_String" }] },
          tables: { INTABLE: { columns: ["id"], rows: [["TEST_001"]] } },
        },
        {
          uniqueName: "fixture_map",
          componentName: "tMap",
          label: "Map de prueba",
          schema: { name: "fixture_map_schema", columns: [{ name: "id", type: "id_String" }] },
          mapper: {
            inputs: [{ name: "row1", columns: [{ name: "id", type: "id_String" }] }],
            outputs: [{ name: "row2", columns: [{ name: "id", type: "id_String", expression: "row1.id" }] }],
          },
        },
      ],
      connections: [{ source: "fixture_source", target: "fixture_map", label: "row1", connectorName: "FLOW" }],
    };
    let nodeReads = 0;
    const bridge = createBridge({
      listNodes: async () => {
        calls.push("listNodes");
        nodeReads++;
        if (nodeReads === 1) return success([]);
        return success([
          { uniqueName: "tFixedFlowInput_actual", componentName: "tFixedFlowInput", label: "Datos de prueba" },
          { uniqueName: "tMap_actual", componentName: "tMap", label: "Map de prueba" },
        ]);
      },
      addNode: async (options) => {
        calls.push(`addNode:${options.type}`);
        return success({ uniqueName: `${options.type}_actual`, saved: true });
      },
      connectNodes: async () => {
        calls.push("connectNodes");
        connected = true;
        return success({ saved: true });
      },
      configureNode: async (options) => {
        calls.push(`configureNode:${options.uniqueName}`);
        if (connected) {
          configured.push({ uniqueName: options.uniqueName, schema: options.schema, mapper: options.mapper });
        }
        return success({ saved: true });
      },
    }, calls);

    await executeCustomSpec(spec, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] });

    expect(configured).toHaveLength(2);
    expect(configured.find((item) => item.uniqueName === "tFixedFlowInput_actual")?.schema?.[0]?.name)
      .toBe("tFixedFlowInput_actual");
    expect(configured.find((item) => item.uniqueName === "tMap_actual")?.schema?.[0]?.name)
      .toBe("tMap_actual");
    expect(calls.indexOf("connectNodes")).toBeLessThan(calls.lastIndexOf("configureNode:tMap_actual"));
  });

  test("no marca como pendiente un schema que se configura por separado", async () => {
    let nodeReads = 0;
    const bridge = createBridge({
      componentParameters: async ({ name }) => success({
        name,
        parameters: name === "tFileInputDelimited"
          ? [{ name: "SCHEMA", required: true, show: true, readOnly: true, default: "" }]
          : [],
      }),
      listNodes: async () => {
        nodeReads++;
        return success(nodeReads === 1 ? [] : [
          { uniqueName: "tFileInputDelimited_studio", componentName: "tFileInputDelimited", label: "Leer clientes" },
          { uniqueName: "tLogRow_studio", componentName: "tLogRow", label: "Mostrar clientes" },
        ]);
      },
    });
    const components = [...baseSpec.components];
    components[0] = {
      ...components[0]!,
      schema: { name: "input_schema", columns: [{ name: "id", type: "id_Integer" }] },
    };

    const result = await executeCustomSpec({ ...baseSpec, components }, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => [],
    });

    expect(result.warnings.some((warning) => warning.includes("SCHEMA"))).toBe(false);
  });

  test("abre el .item heredado exacto y reutiliza nodos coincidentes sin duplicarlos", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      openJob: async (options) => {
        calls.push(`openJob:${options.itemPath}`);
        return success({ opened: true });
      },
      listNodes: async () => {
        calls.push("listNodes");
        return success([
          { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
          { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
        ]);
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec(baseSpec, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => jobs,
    });

    expect(calls).toContain("openJob:process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.item");
    expect(calls.some((call) => call.startsWith("addNode:"))).toBe(false);
    expect(calls).not.toContain("createJob");
    expect(result.reusedExisting).toBe(true);
    expect(result.reusedComponents).toBe(2);
  });

  test("reutiliza un Job de Studio dentro de una carpeta anidada del ZIP", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      openJob: async (options) => {
        calls.push(`openJob:${options.itemPath}`);
        return success({ opened: true });
      },
      listNodes: async () => success([
        { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
        { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
      ]),
    }, calls);
    const folderPath = "Process/PruebasWebSAS/ts-sas-legacy-analytics/BatchJobs";
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/ts-sas-legacy-analytics/BatchJobs/CustomerLoad/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/ts-sas-legacy-analytics/BatchJobs/CustomerLoad/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({ ...baseSpec, folderPath }, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => jobs,
    });

    expect(calls).toContain(
      "openJob:process/PruebasWebSAS/ts-sas-legacy-analytics/BatchJobs/CustomerLoad/CustomerLoad_0.1.item",
    );
    expect(calls).not.toContain("createJob");
    expect(result.reusedExisting).toBe(true);
    expect(result.folderPath).toBe(folderPath);
  });

  test("retira los nodos obsoletos del portal al reconciliar una propuesta corregida", async () => {
    const calls: string[] = [];
    let nodes: Array<Record<string, unknown>> = [
      { uniqueName: "tRunJob_old", componentName: "tRunJob", label: "Incluir autoexec [op_8_include_1]" },
      { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
      { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
    ];
    const bridge = createBridge({
      openJob: async (options) => {
        calls.push(`openJob:${options.itemPath}`);
        return success({ opened: true });
      },
      listNodes: async () => success(nodes),
      deleteNodes: async ({ uniqueNames }) => {
        calls.push(`deleteNodes:${uniqueNames.join(",")}`);
        nodes = nodes.filter((node) => !uniqueNames.includes(String(node.uniqueName)));
        return success({ removed: uniqueNames });
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({
      ...baseSpec,
      instructions: {
        source: { program: "daily.sas", sha256: "source-hash" },
        steps: [{ id: "op_8_include_1" }, { id: "op_10_read_1" }],
      },
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls).toContain("deleteNodes:tRunJob_old");
    expect(result.removedComponents).toBe(1);
    expect(result.reusedComponents).toBe(2);
  });

  test("actualiza etiquetas antiguas usando la referencia SAS corta y reutiliza el nodo", async () => {
    const calls: string[] = [];
    let nodes: Array<Record<string, unknown>> = [
      { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Cargar clientes [op_8_read_1]" },
    ];
    const bridge = createBridge({
      openJob: async () => success({ opened: true }),
      listNodes: async () => success(nodes),
      updateNode: async ({ uniqueName, label }) => {
        calls.push(`updateNode:${uniqueName}:${label}`);
        nodes = nodes.map((node) => node.uniqueName === uniqueName ? { ...node, label } : node);
        return success({ saved: true });
      },
    }, calls);
    const job = {
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    };

    const result = await executeCustomSpec({
      ...baseSpec,
      components: [{ ...baseSpec.components[0]!, label: "Leer clientes · SAS 8" }],
      connections: [],
      contexts: [],
      instructions: { source: { program: "daily.sas" }, steps: [{ id: "op_8_read_1" }] },
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => [job] });

    expect(calls).toContain("updateNode:tFileInputDelimited_3:Leer clientes · SAS 8");
    expect(calls.some((call) => call.startsWith("addNode:"))).toBe(false);
    expect(calls.some((call) => call.startsWith("deleteNodes:"))).toBe(false);
    expect(result.reusedComponents).toBe(1);
    expect(result.generatedComponents).toBe(0);
  });

  test("retira nodos del portal de una versión anterior aunque cambió el ID del paso", async () => {
    const calls: string[] = [];
    let nodes: Array<Record<string, unknown>> = [
      { uniqueName: "tRunJob_old", componentName: "tRunJob", label: "Incluir otro programa [op_8_include_1]" },
      { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
      { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
    ];
    const bridge = createBridge({
      openJob: async () => success({ opened: true }),
      listNodes: async () => success(nodes),
      deleteNodes: async ({ uniqueNames }) => {
        calls.push(`deleteNodes:${uniqueNames.join(",")}`);
        nodes = nodes.filter((node) => !uniqueNames.includes(String(node.uniqueName)));
        return success({ removed: uniqueNames });
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({
      ...baseSpec,
      instructions: {
        source: { program: "daily.sas", sha256: "new-source-hash" },
        steps: [{ id: "op_27_read_1" }, { id: "op_32_write_1" }],
      },
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls).toContain("deleteNodes:tRunJob_old");
    expect(result.removedComponents).toBe(1);
    expect(result.reusedComponents).toBe(2);
  });

  test("reanuda el Job del mismo programa aunque una versión previa lo dejó en la carpeta base", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      listNodes: async () => success([
        { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
        { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
      ]),
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      folderPath: "Process/PruebasWebSAS",
      description: "Migrated from SAS program client/macros/daily.sas",
      purpose: "Generated from migration plan rules-7",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({
      ...baseSpec,
      folderPath: "Process/PruebasWebSAS/client/macros",
      description: "Migrated from SAS program client/macros/daily.sas",
      purpose: "Generated from migration plan rules-7",
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls).toContain("openJob:process/PruebasWebSAS/CustomerLoad_0.1.item");
    expect(calls).not.toContain("createJob");
    expect(result.reusedExisting).toBe(true);
    expect(result.folderPath).toBe("Process/PruebasWebSAS");
  });

  test("actualiza variables existentes del contexto antes de agregar nuevas", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      jobContexts: async (options) => {
        calls.push(`jobContexts:${options?.job}`);
        return success({ contexts: [{
          name: "Default",
          isDefault: true,
          parameters: [{ name: "range_id", type: "id_String", value: "" }],
        }] });
      },
      setJobContextParameter: async (options) => {
        calls.push(`setJobContextParameter:${options.context}:${options.name}:${options.value}:${options.type}`);
        return success({ created: false });
      },
      listNodes: async () => success([
        { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
        { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
      ]),
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    await executeCustomSpec({
      ...baseSpec,
      contexts: [{ name: "range_id", type: "id_String", value: "TEST_RANGE_001", comment: "Rango sintético" }],
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls).toContain("jobContexts:CustomerLoad");
    expect(calls).toContain("setJobContextParameter:Default:range_id:TEST_RANGE_001:id_String");
    expect(calls).not.toContain("addContextParameters");
  });

  test("conserva un contexto ya llenado cuando el portal solo envía un marcador vacío", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      jobContexts: async () => success({ contexts: [{
        name: "Default",
        isDefault: true,
        parameters: [{ name: "input_path", type: "id_String", value: "C:/datos/clientes.csv" }],
      }] }),
      listNodes: async () => success([
        { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
        { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
      ]),
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({
      ...baseSpec,
      contexts: [{ name: "input_path", type: "id_String", value: "", comment: "Ruta pendiente de confirmar" }],
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls.some((call) => call.startsWith("setJobContextParameter:Default:input_path:"))).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("input_path") && warning.includes("conservó"))).toBe(true);
  });

  test("ignora las instrucciones heredadas de datos sintéticos y conserva conexiones existentes", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      activeJobModel: async () => success({
        job: { label: "CustomerLoad", version: "0.1" },
        connections: [{
          source: "tLogRow_4",
          target: "tFileInputDelimited_3",
          name: "OnSubjobOk",
          type: "ON_SUBJOB_OK",
        }],
      }),
      listNodes: async () => success([
        { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "Leer clientes" },
        { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "Mostrar clientes" },
      ]),
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec({
      ...baseSpec,
      instructions: { executionMode: { kind: "synthetic_test_data" } },
    }, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs });

    expect(calls.some((call) => call.startsWith("disconnectNodes:"))).toBe(false);
    expect(result.removedConnections).toBe(0);
  });

  test("reemplaza una salida FLOW obsoleta por la salida FILTER solicitada", async () => {
    const calls: string[] = [];
    const spec: CustomSpecInput = {
      ...baseSpec,
      contexts: [],
      components: [
        { uniqueName: "tFilterRow_1", componentName: "tFilterRow", label: "Filtro SAS", parameters: {} },
        { uniqueName: "tLogRow_2", componentName: "tLogRow", label: "Salida de prueba", parameters: {} },
      ],
      connections: [
        { source: "tFilterRow_1", target: "tLogRow_2", label: "row1", connectorName: "FILTER" },
      ],
      instructions: { executionMode: { kind: "synthetic_test_data" } },
    };
    const bridge = createBridge({
      activeJobModel: async () => success({
        job: { label: "CustomerLoad", version: "0.1" },
        connections: [{
          source: "tFilterRow_studio",
          target: "tLogRow_studio",
          name: "row1",
          type: "FLOW",
          connectorName: "FLOW",
        }],
      }),
      listNodes: async () => success([
        { uniqueName: "tFilterRow_studio", componentName: "tFilterRow", label: "Filtro SAS" },
        { uniqueName: "tLogRow_studio", componentName: "tLogRow", label: "Salida de prueba" },
      ]),
      disconnectNodes: async ({ source, target, name }) => {
        calls.push(`disconnectNodes:${source}:${target}:${name}`);
        return success({ removed: true, count: 1 });
      },
      connectNodes: async ({ source, target, type, name }) => {
        calls.push(`connectNodes:${source}:${target}:${type}:${name}`);
        return success({ saved: true });
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/CustomerLoad/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec(spec, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => jobs,
    });

    expect(calls).toContain("disconnectNodes:tFilterRow_studio:tLogRow_studio:row1");
    expect(calls).toContain("connectNodes:tFilterRow_studio:tLogRow_studio:FILTER:row1");
    expect(result.removedConnections).toBe(1);
    expect(result.generatedConnections).toBe(1);
  });

  test("espera a que Studio active el Job abierto antes de modificarlo", async () => {
    const calls: string[] = [];
    let activeReads = 0;
    let nodeReads = 0;
    const bridge = createBridge({
      activeJobModel: async () => {
        activeReads++;
        calls.push(`activeJobModel:${activeReads}`);
        return success(activeReads === 1
          ? { job: { available: true, getLabel: "PruebaIngesta5x5", getVersion: "0.1" }, connections: [] }
          : { job: { available: true, getLabel: "CustomerLoad", getVersion: "0.1" }, connections: [] });
      },
      listNodes: async () => {
        nodeReads++;
        calls.push(`listNodes:${nodeReads}`);
        return success(nodeReads === 1 ? [] : [
          { uniqueName: "tFileInputDelimited_studio", componentName: "tFileInputDelimited", label: "Leer clientes" },
          { uniqueName: "tLogRow_studio", componentName: "tLogRow", label: "Mostrar clientes" },
        ]);
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec(baseSpec, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => jobs,
    });

    expect(activeReads).toBe(2);
    expect(calls.indexOf("activeJobModel:2")).toBeLessThan(calls.indexOf("listNodes:1"));
    expect(result.reusedExisting).toBe(true);
    expect(result.generatedComponents).toBe(2);
  });

  test("reanuda nodos antiguos con etiqueta autogenerada solo si la secuencia completa coincide", async () => {
    const calls: string[] = [];
    const legacyNodes = [
      { uniqueName: "tFileInputDelimited_3", componentName: "tFileInputDelimited", label: "tFileInputDelimited_3" },
      { uniqueName: "tLogRow_4", componentName: "tLogRow", label: "tLogRow_4" },
    ];
    const bridge = createBridge({
      listNodes: async () => {
        calls.push("listNodes");
        return success(legacyNodes);
      },
      updateNode: async (options) => {
        calls.push(`updateNode:${options.uniqueName}:${options.label ?? ""}`);
        const node = legacyNodes.find((item) => item.uniqueName === options.uniqueName);
        if (node && options.label) node.label = options.label;
        return success({ saved: true });
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    const result = await executeCustomSpec(baseSpec, {
      bridge,
      projectPath: "C:/talend/project",
      listJobs: async () => jobs,
    });

    expect(calls.some((call) => call.startsWith("addNode:"))).toBe(false);
    expect(calls).toContain("updateNode:tFileInputDelimited_3:Leer clientes");
    expect(calls).toContain("updateNode:tLogRow_4:Mostrar clientes");
    expect(calls).toContain("configureNode:tFileInputDelimited_3");
    expect(result.reusedComponents).toBe(2);
    expect(result.generatedComponents).toBe(0);
  });

  test("preserva un Job existente cuando una operación de Studio falla", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      listNodes: async () => {
        calls.push("listNodes");
        return success([]);
      },
      addContextParameters: async () => {
        calls.push("addContextParameters");
        return success({ saved: false });
      },
    }, calls);
    const jobs = [{
      label: "CustomerLoad",
      version: "0.1",
      itemPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.item",
      propertiesPath: "C:/talend/project/process/PruebasWebSAS/CustomerLoad_0.1.properties",
    }];

    await expect(executeCustomSpec(baseSpec, { bridge, projectPath: "C:/talend/project", listJobs: async () => jobs }))
      .rejects.toThrow("se conservó");
    expect(calls).not.toContain("deleteJob");
  });

  test("retira únicamente un Job nuevo si falla una operación posterior", async () => {
    const calls: string[] = [];
    const bridge = createBridge({
      addContextParameters: async () => {
        calls.push("addContextParameters");
        return { ok: false, source: "unavailable", confidence: "low", endpoint: "/test", error: { code: "SAVE", message: "falló el guardado" } };
      },
    }, calls);

    await expect(executeCustomSpec(baseSpec, { bridge, projectPath: "C:/talend/project", listJobs: async () => [] }))
      .rejects.toThrow("retiró el Job nuevo");
    expect(calls).toContain("deleteJob");
  });
});
