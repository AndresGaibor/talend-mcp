import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseJobItem } from "../../src/talend/job-parser";
import { inspectTalendComponent, inspectTalendJob } from "../../src/talend/inspection";

describe("Talend inspection", () => {
  test("inspecciona un componente por uniqueName con atributos y conexiones", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const inspection = inspectTalendComponent(job, { uniqueName: "tFileInputDelimited_1", includeRaw: true });

    expect(inspection.component.uniqueName).toBe("tFileInputDelimited_1");
    expect(inspection.component.componentName).toBe("tFileInputDelimited");
    expect(inspection.component.parameters.FILENAME).toBe("context.FILE_OLIST_ORDERS");
    expect(inspection.component.nodeAttributes.posX).toBe("80");
    expect(inspection.component.nodeAttributes.posY).toBe("160");
    expect(inspection.outgoingConnections.map((connection: { target: string }) => connection.target)).toEqual(["tMap_1"]);
    expect(inspection.incomingConnections).toEqual([]);
    expect(inspection.raw?.nodeAttributes.posX).toBe("80");
  });

  test("inspecciona el job completo con estadisticas y componentes", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const inspection = inspectTalendJob(job);

    expect(inspection.stats.componentCount).toBe(3);
    expect(inspection.stats.connectionCount).toBe(2);
    expect(inspection.stats.schemaIssueCount).toBe(0);
    expect(inspection.components.map((component: { component: { uniqueName: string } }) => component.component.uniqueName)).toEqual([
      "tFileInputDelimited_1",
      "tMap_1",
      "tDBOutput_1",
    ]);
    expect(
      inspection.components
        .find((component: { component: { uniqueName: string } }) => component.component.uniqueName === "tDBOutput_1")
        ?.incomingConnections.map((connection: { source: string }) => connection.source),
    ).toEqual(["tMap_1"]);
  });
});
