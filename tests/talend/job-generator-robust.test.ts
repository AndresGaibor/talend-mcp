import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildJobItemXml, buildJobPropertiesXml } from "../../src/talend/job-generator";

describe("job generator robusto", () => {
  test("genera XML con IDs validos y soporta folderPath", () => {
    const spec = {
      jobName: "JobRobustTest",
      folderPath: "test/unit",
      purpose: "Probar robustez",
      components: [
        {
          uniqueName: "tFixedFlowInput_1",
          componentName: "tFixedFlowInput",
          posX: 100,
          posY: 100
        },
        {
          uniqueName: "tLogRow_1",
          componentName: "tLogRow",
          posX: 300,
          posY: 100
        }
      ],
      connections: [
        {
          source: "tFixedFlowInput_1",
          target: "tLogRow_1",
          label: "row1",
          connectorName: "FLOW"
        }
      ]
    };

    const { xml: itemXml, rootId } = buildJobItemXml(spec);
    const propertiesXml = buildJobPropertiesXml(spec, rootId);

    // Verificaciones Item
    expect(itemXml).toContain('xmi:version="2.0"');
    expect(itemXml).toContain('xmi:id="' + rootId + '"');
    expect(itemXml).toContain('componentName="tFixedFlowInput"');
    expect(itemXml).toContain('componentName="tLogRow"');
    
    // Verificar que cada componente tenga su xmi:id
    const componentIds = itemXml.match(/xmi:id="_[A-Za-z0-9\-_]{22}"/g);
    expect(componentIds?.length).toBeGreaterThanOrEqual(3); // root + 2 componentes

    // Verificaciones Properties
    expect(propertiesXml).toContain('label="JobRobustTest"');
    expect(propertiesXml).toContain('path="test/unit"');
    // La raiz del .item se referencia como Studio: `#/`.
    expect(propertiesXml).toContain('href="JobRobustTest_0.1.item#/"');
    
    // Verificar que el .properties tenga IDs validos
    expect(propertiesXml).toContain('TalendProperties:Property');
    const propIds = propertiesXml.match(/xmi:id=\"_[^\"]+\"/g);
    expect(propIds?.length).toBeGreaterThanOrEqual(3); // Property, ItemState, ProcessItem
  });

  test("las referencias cruzadas del .properties apuntan a ids que existen: sin ellas Studio no enlaza el item", () => {
    const { xml, rootId } = buildJobItemXml({ jobName: "JobRefs", components: [{ uniqueName: "tLogRow_1", componentName: "tLogRow" }] });
    const properties = buildJobPropertiesXml({ jobName: "JobRefs", components: [] }, rootId);
    const xmiIds = new Set([...properties.matchAll(/xmi:id="([^"]+)"/g)].map((m) => m[1]));

    const property = /<TalendProperties:Property[^>]*\sitem="([^"]+)"/.exec(properties)![1]!;
    const processItem = /<TalendProperties:ProcessItem[^>]*\sproperty="([^"]+)"[^>]*\sstate="([^"]+)"/.exec(properties)!;

    expect(xmiIds.has(property)).toBe(true);
    expect(xmiIds.has(processItem[1]!)).toBe(true);
    expect(xmiIds.has(processItem[2]!)).toBe(true);
    expect(xml).toContain('xmi:id="' + rootId + '"');
  });
});
