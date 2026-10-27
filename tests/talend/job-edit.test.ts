import { describe, expect, test } from "bun:test";
import { buildJobItemXml } from "../../src/talend/job-generator";
import { applyJobEdits } from "../../src/talend/editor/job-edit";
import { parseXml } from "../../src/talend/xml";

const base = buildJobItemXml({
  jobName: "J",
  components: [
    {
      uniqueName: "tFixedFlowInput_1",
      componentName: "tFixedFlowInput",
      schema: { name: "tFixedFlowInput_1", columns: [{ name: "a", type: "string" }] },
    },
    { uniqueName: "tLogRow_1", componentName: "tLogRow" },
  ],
  connections: [
    { source: "tFixedFlowInput_1", target: "tLogRow_1", label: "row1", connectorName: "FLOW", metaname: "tFixedFlowInput_1" },
  ],
}).xml;

describe("applyJobEdits", () => {
  test("aplica un lote: nodo, parametros, esquema, conexion y contexto", () => {
    const result = applyJobEdits(base, [
      { op: "add_node", uniqueName: "tLogRow_2", componentName: "tLogRow", posX: 400 },
      {
        op: "connect",
        source: "tFixedFlowInput_1",
        target: "tLogRow_2",
        label: "row2",
        connectorName: "FLOW",
        metaname: "tFixedFlowInput_1",
      },
      { op: "set_params", uniqueName: "tLogRow_1", parameters: { TABLE_PRINT: "true" } },
      { op: "set_schema", uniqueName: "tFixedFlowInput_1", columns: [{ name: "a" }, { name: "b", type: "int" }] },
      { op: "set_context", name: "HOST", value: "localhost" },
    ]);
    expect(result.changed).toBe(true);
    expect(result.xml).toContain("tLogRow_2");
    expect(result.xml).toContain('name="b"');
    expect(result.xml).toContain("HOST");
    expect(parseXml(result.xml)).toBeTruthy();
  });

  test("quitar un nodo quita sus conexiones", () => {
    const result = applyJobEdits(base, [{ op: "remove_node", uniqueName: "tLogRow_1" }]);
    expect(result.xml).not.toContain("tLogRow_1");
    expect(result.xml).not.toContain("row1");
  });

  test("es atomico: una conexion a un nodo inexistente no produce XML", () => {
    expect(() =>
      applyJobEdits(base, [{ op: "connect", source: "tFixedFlowInput_1", target: "nada", label: "row9" }]),
    ).toThrow(/inconsistente/);
  });

  test("avisa de que operacion falla", () => {
    expect(() => applyJobEdits(base, [{ op: "move", uniqueName: "nada", posX: 1, posY: 1 }])).toThrow(
      /Operacion 1 \(move\)/,
    );
  });

  test("rechaza un UNIQUE_NAME repetido", () => {
    expect(() => applyJobEdits(base, [{ op: "add_node", uniqueName: "tLogRow_1", componentName: "tLogRow" }])).toThrow(
      /Ya existe/,
    );
  });
});
