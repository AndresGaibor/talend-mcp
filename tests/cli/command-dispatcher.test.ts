import { describe, expect, test } from "bun:test";
import {
  CliOperationError,
  describeOperation,
  executeOperation,
  getPolicy,
  listOperations,
} from "../../src/application/operations/command-dispatcher";

describe("CLI operation dispatcher", () => {
  test("exposes the intentionally classified MVP operations", () => {
    const operations = listOperations();
    expect(operations.find(({ name }) => name === "talend_jobs_list")?.risk).toBe("read");
    expect(operations.find(({ name }) => name === "talend_jobs_create")?.risk).toBe("write");
    // Sin politica explicita, el riesgo se deriva de getToolRisk: el CLI
    // queda como segunda entrada al MCP para cualquier tool registrada.
    expect(getPolicy("talend_job_verify")).toBe("write");
  });

  test("describes registered operations and rejects unknown ones", () => {
    expect(describeOperation("talend_jobs_list").risk).toBe("read");
    expect(() => describeOperation("not_a_tool")).toThrow(CliOperationError);
  });

  test("blocks writes without explicit CLI authorization", async () => {
    await expect(executeOperation("talend_jobs_create", { jobName: "CLI_TEST" }))
      .rejects.toMatchObject({ code: "DENIED" });
  });

  test("rejects unclassified operations and invalid input before invoking handlers", async () => {
    const unclassified = listOperations().find(({ risk }) => risk === "unclassified");
    // getPolicy ahora deriva de getToolRisk: ninguna tool queda sin clasificar.
    expect(unclassified).toBeUndefined();
    await expect(executeOperation("talend_jobs_read", {}))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
