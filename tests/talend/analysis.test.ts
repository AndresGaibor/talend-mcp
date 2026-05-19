import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { analyzeTdbOutputs, findSchemaIssues } from "../../src/talend/analysis";
import { parseJobItem } from "../../src/talend/job-parser";

describe("Talend analysis", () => {
  test("analiza tDBOutput/tMysqlOutput", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const outputs = analyzeTdbOutputs(job);

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.uniqueName).toBe("tDBOutput_1");
    expect(outputs[0]?.componentName).toBe("tMysqlOutput");
    expect(outputs[0]?.table).toBe("stg_olist_orders_ag");
    expect(outputs[0]?.tableAction).toBe("TRUNCATE");
    expect(outputs[0]?.dataAction).toBe("INSERT");
  });

  test("detecta columnas vacías y null", () => {
    const issues = findSchemaIssues({
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tBad_1",
          componentName: "tMap",
          parameters: {},
          schemas: [{ name: "out1", columns: [{ name: "" }, { name: "null" }] }],
        },
      ],
    });

    expect(issues.map((issue) => issue.issue)).toEqual(["empty-column-name", "null-column-name"]);
  });
});