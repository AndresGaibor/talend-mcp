import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseLaunchConfig, parseOpenJobsFromWorkbench } from "../../src/talend/open-job";

describe("open job detection", () => {
  test("detecta job abierto desde workbench XMI", async () => {
    const xml = await readTextFile("tests/fixtures/talend/workbench.xmi");
    const jobs = parseOpenJobsFromWorkbench(xml, "tests/fixtures/talend/workbench.xmi");

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.jobName).toBe("lab04_olist_orders_to_staging");
    expect(jobs[0]?.version).toBe("0.1");
    expect(jobs[0]?.label).toBe("Job lab04_olist_orders_to_staging 0.1");
  });

  test("parsea launch config de Talend", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch");
    const launch = parseLaunchConfig(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging 0.1.launch");

    expect(launch.currentProjectName).toBe("PRJ_GENIUS_LAB");
    expect(launch.jobName).toBe("lab04_olist_orders_to_staging");
    expect(launch.jobVersion).toBe("0.1");
    expect(launch.jobId).toBe("_DzivYFL-EfGooKJ9qOgNNQ");
  });
});