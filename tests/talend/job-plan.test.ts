import { describe, expect, test } from "bun:test";
import { planConnections, planJobAssembly } from "../../scripts/l5/job-plan";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

function definition(name: string, connectors: ComponentDefinition["connectors"]): ComponentDefinition {
  return {
    name,
    family: "Processing",
    families: ["Processing"],
    startable: false,
    palette: "DI",
    pluginId: "test-plugin",
    definitionPath: "component_java.xml",
    parameters: [],
    requiredParameters: [],
    connectors,
    imports: [],
    returns: [],
  };
}

describe("constructor de conexiones de jobs Talend", () => {
  test("elige el conector de salida de la definicion, no asume FLOW", () => {
    const result = planConnections(
      [
        { nombre: "origen", type: "tUniqRow" },
        { nombre: "destino", type: "tLogRow" },
      ],
      [{ origen: "origen", destino: "destino" }],
      new Map([
        ["tUniqRow", definition("tUniqRow", [
          { name: "FLOW", type: "FLOW", maxInput: 1, maxOutput: 0 },
          { name: "UNIQUE", type: "FLOW", maxInput: 0, maxOutput: 1 },
          { name: "DUPLICATE", type: "FLOW", maxInput: 0, maxOutput: 1 },
        ])],
      ]),
    );

    expect(result).toEqual({
      ok: true,
      connections: [{ source: "origen", target: "destino", type: "UNIQUE" }],
    });
  });

  test("respeta el tipo declarado y rechaza referencias a nodos inexistentes", () => {
    const definitions = new Map([
      ["tFixedFlowInput", definition("tFixedFlowInput", [])],
    ]);
    expect(planConnections(
      [{ nombre: "entrada", type: "tFixedFlowInput" }, { nombre: "itera", type: "tFlowToIterate" }],
      [{ origen: "entrada", destino: "itera", tipo: "FLOW" }],
      definitions,
    )).toEqual({
      ok: true,
      connections: [{ source: "entrada", target: "itera", type: "FLOW" }],
    });

    expect(planConnections(
      [{ nombre: "entrada", type: "tFixedFlowInput" }],
      [{ origen: "entrada", destino: "ausente" }],
      definitions,
    )).toEqual({ ok: false, error: "conexion sin nodos: entrada -> ausente" });
  });

  test("ordena el re-aplicado de schemas despues de conectar y difiere tablas y mapper", () => {
    const result = planJobAssembly(
      {
        nodes: [
          { nombre: "origen", type: "tFixedFlowInput", schemaDespuesDeConectar: true },
          { nombre: "salida", type: "tAggregateRow", schemaDespuesDeConectar: true, tablas: {} },
          { nombre: "mapa", type: "tMap", mapper: {} },
        ],
        connections: [{ origen: "origen", destino: "salida" }],
      },
      new Map(),
    );

    expect(result).toEqual({
      ok: true,
      nodes: ["origen", "salida", "mapa"],
      connections: [{ source: "origen", target: "salida", type: "FLOW" }],
      afterConnect: {
        schemas: ["salida", "origen"],
        tables: ["salida"],
        mappers: ["mapa"],
      },
    });
  });
});
