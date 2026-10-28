import { describe, expect, test } from "bun:test";
import { XMLParser } from "fast-xml-parser";
import { buildJobItemXml, type JobSpec } from "../../src/talend/job-generator";
import { mapTablesFor, withMapperMetanames } from "../../src/talend/job-generator/component-node";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const lista = (valor: unknown): any[] => (Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]);

/** Un tMap con una entrada y una salida cuyos nombres no son los `row1`/`out1` por defecto (lo que genera el portal). */
const spec: JobSpec = {
  jobName: "job_con_tmap",
  components: [
    { uniqueName: "tFixedFlowInput_1", componentName: "tFixedFlowInput" },
    { uniqueName: "tMap_1", componentName: "tMap", componentVersion: "2.1" },
    { uniqueName: "tFilterColumns_2", componentName: "tFilterColumns" },
  ],
  connections: [
    { source: "tFixedFlowInput_1", target: "tMap_1", label: "row_in", uniqueName: "flow_in", connectorName: "FLOW" },
    { source: "tMap_1", target: "tFilterColumns_2", label: "row_3_1", uniqueName: "flow_3_1", connectorName: "FLOW" },
  ],
};

function documento(jobSpec: JobSpec) {
  return parser.parse(buildJobItemXml(jobSpec).xml)["talendfile:ProcessType"];
}

describe("las tablas de un tMap siguen a sus conexiones", () => {
  test("la tabla de salida, su esquema y el metaname de la conexion llevan el nombre de la conexion que sale", () => {
    const proceso = documento(spec);
    const tMap = lista(proceso.node).find((n) => n["@_componentName"] === "tMap");

    // Studio avisa "Some errors appear after the migration in the following connections" si no coinciden.
    expect(tMap.nodeData.outputTables["@_name"]).toBe("flow_3_1");
    expect(tMap.metadata["@_name"]).toBe("flow_3_1");
    expect(tMap.metadata["@_connector"]).toBe("FLOW");
    const salida = lista(proceso.connection).find((c) => c["@_source"] === "tMap_1");
    expect(salida["@_metaname"]).toBe("flow_3_1");
  });

  test("la tabla de entrada lleva el nombre de la conexion que entra", () => {
    const tMap = lista(documento(spec).node).find((n) => n["@_componentName"] === "tMap");

    expect(tMap.nodeData.inputTables["@_name"]).toBe("flow_in");
  });

  test("varias salidas y varios lookups dan una tabla por conexion", () => {
    const grande = {
      ...spec,
      components: [...spec.components, { uniqueName: "tLogRow_3", componentName: "tLogRow" }, { uniqueName: "tFixedFlowInput_4", componentName: "tFixedFlowInput" }],
      connections: [
        ...(spec.connections ?? []),
        { source: "tMap_1", target: "tLogRow_3", label: "out_b", connectorName: "FLOW" },
        { source: "tFixedFlowInput_4", target: "tMap_1", label: "lookup_a", connectorName: "FLOW" },
      ],
    };
    const tMap = lista(documento(grande).node).find((n) => n["@_componentName"] === "tMap");

    expect(lista(tMap.nodeData.outputTables).map((t) => t["@_name"])).toEqual(["flow_3_1", "out_b"]);
    expect(lista(tMap.metadata).map((t) => t["@_name"])).toEqual(["flow_3_1", "out_b"]);
    expect(lista(tMap.nodeData.inputTables).map((t) => [t["@_name"], t["@_matchingMode"]])).toEqual([
      ["flow_in", "ALL_ROWS"],
      ["lookup_a", "UNIQUE_MATCH"],
    ]);
  });

  test("las columnas del esquema del tMap pasan a cada tabla de salida", () => {
    const conEsquema = {
      ...spec,
      components: spec.components.map((c) =>
        c.componentName === "tMap" ? { ...c, schema: { name: "tMap_1", columns: [{ name: "topic_id", type: "id_Integer" }] } } : c,
      ),
    };
    const tMap = lista(documento(conEsquema).node).find((n) => n["@_componentName"] === "tMap");

    expect(tMap.metadata["@_name"]).toBe("flow_3_1");
    expect(lista(tMap.metadata.column).map((c) => c["@_name"])).toEqual(["topic_id"]);
  });

  test("un tMap sin conexiones conserva las tablas por defecto, como el que crea Studio", () => {
    const solo = { jobName: "solo", components: [{ uniqueName: "tMap_1", componentName: "tMap" }], connections: [] };
    const tMap = documento(solo).node;

    expect(tMap.nodeData.outputTables["@_name"]).toBe("out1");
    expect(tMap.nodeData.inputTables["@_name"]).toBe("row1");
    expect(tMap.metadata).toBeUndefined();
  });

  test("los disparadores y las conexiones de otros componentes no se tocan", () => {
    const conexiones = [
      { source: "tFixedFlowInput_1", target: "tMap_1", label: "OnSubjobOk", connectorName: "SUBJOB_OK" },
      { source: "tFixedFlowInput_1", target: "tFilterColumns_2", label: "row9", connectorName: "FLOW" },
    ];

    expect(mapTablesFor("tMap_1", conexiones)).toEqual({ inputs: [], outputs: [] });
    expect(withMapperMetanames(spec.components, conexiones)).toEqual(conexiones);
  });
});
