import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseJobItem } from "../../src/talend/job-parser";
import { parseJobProperties } from "../../src/talend/repository";

describe("Talend job parser", () => {
  test("extrae componentes, conexiones, schemas, contexts y mapper entries", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    expect(job.components.map((component) => component.uniqueName)).toEqual([
      "tFileInputDelimited_1",
      "tMap_1",
      "tDBOutput_1",
    ]);
    expect(job.connections.map((connection) => `${connection.source}->${connection.target}`)).toEqual([
      "tFileInputDelimited_1->tMap_1",
      "tMap_1->tDBOutput_1",
    ]);
    expect(job.contexts.find((contexto) => contexto.name === "FILE_OLIST_ORDERS")?.value).toContain(
      "orders.csv",
    );
    expect(job.mapperEntries.find((entry) => entry.name === "load_source")?.expression).toContain(
      "lab04_olist_orders_to_staging",
    );
  });

  test("parsea properties y resuelve item", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");
    const resource = parseJobProperties(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");

    expect(resource.label).toBe("lab04_olist_orders_to_staging");
    expect(resource.version).toBe("0.1");
    expect(resource.itemPath.endsWith("lab04_olist_orders_to_staging_0.1.item")).toBe(true);
  });
});