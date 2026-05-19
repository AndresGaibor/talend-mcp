import { describe, expect, test } from "bun:test";
import { parseXml, asArray } from "../../src/talend/xml";

describe("parseXml", () => {
  test("preserva atributos XML con prefijo @", () => {
    const xml = `<root><node componentName="tMap"><elementParameter name="UNIQUE_NAME" value="tMap_1"/></node></root>`;

    const parsed = parseXml(xml) as {
      root: {
        node: {
          "@_componentName": string;
          elementParameter: { "@_name": string; "@_value": string };
        };
      };
    };

    expect(parsed.root.node["@_componentName"]).toBe("tMap");
    expect(parsed.root.node.elementParameter["@_name"]).toBe("UNIQUE_NAME");
    expect(parsed.root.node.elementParameter["@_value"]).toBe("tMap_1");
  });
});

describe("asArray", () => {
  test("convierte valor unico en array", () => {
    expect(asArray("hola")).toEqual(["hola"]);
  });

  test("devuelve array tal cual si ya es array", () => {
    expect(asArray(["a", "b"])).toEqual(["a", "b"]);
  });

  test("devuelve array vacio para undefined o null", () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });
});