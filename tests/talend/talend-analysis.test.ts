import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseJobItem } from "../../src/talend/job-parser";
import { analyzeJob, formatAnalysis } from "../../src/talend/talend-analysis";

describe("talend-analysis", () => {
  test("analiza job y detecta problemas de schema", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const analysis = analyzeJob(job);

    expect(analysis.stats.componentCount).toBe(3);
    expect(analysis.stats.connectionCount).toBe(2);
    expect(analysis.stats.schemaIssueCount).toBe(0);
    expect(analysis.tdbOutputs.length).toBe(1);
    expect(analysis.tdbOutputs[0]?.table).toBe("stg_olist_orders_ag");
  });

  test("detecta columnas con problemas de schema", () => {
    const job = {
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
    };

    const analysis = analyzeJob(job);
    expect(analysis.schemaIssues.length).toBe(2);
    expect(analysis.issues.some((i) => i.severity === "critical")).toBe(true);
    expect(analysis.summary).toContain("problema");
  });

  test("formatAnalysis genera texto legible", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const analysis = analyzeJob(job);
    const formatted = formatAnalysis(analysis);

    expect(formatted).toContain("ANÁLISIS DE JOB");
    expect(formatted).toContain("ESTADÍSTICAS");
    expect(formatted).toContain("stg_olist_orders_ag");
    expect(formatted).toContain("tDBOutput");
  });

  test("detecta conexiones referencing componentes inexistentes", () => {
    const job = {
      itemPath: "fixture.item",
      contexts: [],
      connections: [
        { source: "tFileInputDelimited_1", target: "tMap_1", label: "flow" },
        { source: "tMap_1", target: "tNonExistent_99", label: "orphan" },
      ],
      mapperEntries: [],
      components: [
        { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited", nodeAttributes: {}, parameters: {}, schemas: [] },
        { uniqueName: "tMap_1", componentName: "tMap", nodeAttributes: {}, parameters: {}, schemas: [] },
      ],
    };

    const analysis = analyzeJob(job);
    const warnings = analysis.issues.filter((i) => i.severity === "warning");
    expect(warnings.length).toBeGreaterThan(0);
  });

  test("summary es correto cuando no hay problemas", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const analysis = analyzeJob(job);
    expect(analysis.summary).toContain("sin problemas");
  });
});