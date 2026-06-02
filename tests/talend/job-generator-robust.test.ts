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
    expect(propertiesXml).toContain('href="JobRobustTest_0.1.item#' + rootId + '"');
    
    // Verificar que el .properties tenga IDs validos
    expect(propertiesXml).toContain('TalendProperties:Property');
    const propIds = propertiesXml.match(/xmi:id=\"_[^\"]+\"/g);
    expect(propIds?.length).toBeGreaterThanOrEqual(3); // Property, ItemState, ProcessItem
  });
});
