import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { analyzeTdbOutputs, findSchemaIssues, analyzeColumns, summarizeColumnIssues } from "../../src/talend/analysis";
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
          nodeAttributes: {},
          parameters: {},
          schemas: [{ name: "out1", columns: [{ name: "" }, { name: "null" }] }],
        },
      ],
    });

    expect(issues.map((issue) => issue.issue)).toEqual(["empty-column-name", "null-column-name"]);
  });

  test("analyzeColumns detecta reserved keywords", () => {
    const job = {
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tMap_1",
          componentName: "tMap",
          nodeAttributes: {},
          parameters: {},
          schemas: [{
            name: "out1",
            columns: [
              { name: "select" },
              { name: "index" },
              { name: "order" },
            ],
          }],
        },
      ],
    };

    const results = analyzeColumns(job);
    const summary = summarizeColumnIssues(results);
    expect(summary.warnings).toBeGreaterThan(0);
    expect(summary.byType["reserved-keyword"]).toBe(3);
  });

  test("analyzeColumns detecta columnas sin tipo", () => {
    const job = {
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tMap_1",
          componentName: "tMap",
          nodeAttributes: {},
          parameters: {},
          schemas: [{
            name: "out1",
            columns: [
              { name: "campo_sin_tipo", type: "" },
              { name: "campo_ok", type: "id_String" },
            ],
          }],
        },
      ],
    };

    const results = analyzeColumns(job);
    const noType = results.filter((r) => r.issues.some((i) => i.type === "missing-type"));
    expect(noType.length).toBeGreaterThan(0);
  });

  test("analyzeColumns detecta nombres excesivamente largos", () => {
    const longName = "a".repeat(80);
    const job = {
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tMap_1",
          componentName: "tMap",
          nodeAttributes: {},
          parameters: {},
          schemas: [{
            name: "out1",
            columns: [{ name: longName }],
          }],
        },
      ],
    };

    const results = analyzeColumns(job);
    const longIssues = results.filter((r) => r.issues.some((i) => i.type === "excessive-length"));
    expect(longIssues.length).toBeGreaterThan(0);
  });

  test("analyzeColumns detecta columnas con espacios", () => {
    const job = {
      itemPath: "fixture.item",
      contexts: [],
      connections: [],
      mapperEntries: [],
      components: [
        {
          uniqueName: "tMap_1",
          componentName: "tMap",
          nodeAttributes: {},
          parameters: {},
          schemas: [{
            name: "out1",
            columns: [{ name: "nombre con espacios" }],
          }],
        },
      ],
    };

    const results = analyzeColumns(job);
    const withSpaces = results.filter((r) => r.issues.some((i) => i.type === "name-with-spaces"));
    expect(withSpaces.length).toBe(1);
  });
});
