import { describe, expect, test } from "bun:test";
import { buildJobletItemXml, buildJobletPropertiesXml } from "../../src/talend/job-generator";

describe("Talend Joblet Generator", () => {
  test("generates valid joblet item XML structure", () => {
    const spec = {
      jobletName: "JL_test_calidad",
      version: "0.1",
      defaultContext: "Default",
      contexts: [
        { name: "strict_mode", type: "id_Boolean", value: "true" }
      ],
      components: [
        {
          uniqueName: "INPUT_1",
          componentName: "INPUT",
          posX: 100,
          posY: 100
        }
      ]
    };

    const { xml, rootId } = buildJobletItemXml(spec);
    expect(xml).toContain("model:JobletProcess");
    expect(xml).toContain('defaultContext="Default"');
    expect(xml).toContain('name="strict_mode"');
    expect(xml).toContain('componentName="INPUT"');
    expect(rootId).toBeDefined();
  });

  test("generates valid joblet properties XML structure", () => {
    const spec = {
      jobletName: "JL_test_calidad",
      version: "0.1",
      label: "JL_test_calidad",
      folderPath: "quality"
    };

    const xml = buildJobletPropertiesXml(spec, "root_id_123");
    expect(xml).toContain("TalendProperties:JobletProcessItem");
    expect(xml).toContain('path="quality"');
    expect(xml).toContain('href="JL_test_calidad_0.1.item#root_id_123"');
  });
});
