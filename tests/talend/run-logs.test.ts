import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseLatestRunLog } from "../../src/talend/run-logs";

describe("run logs", () => {
  test("extrae errores históricos y clasifica latest command sin cierre como unknown", async () => {
    const log = await readTextFile("tests/fixtures/talend/metadata.log");
    const latest = parseLatestRunLog(log, "lab04_olist_orders_to_staging");

    expect(latest.jobName).toBe("lab04_olist_orders_to_staging");
    expect(latest.status).toBe("unknown");
    expect(latest.latestCommand?.message).toContain("Command line");
    expect(latest.errors[0]?.message).toContain("wrong configuration");
  });
});