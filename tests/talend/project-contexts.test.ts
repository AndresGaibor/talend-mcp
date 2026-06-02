import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTalendJob } from "../../src/talend/job-crud";
import { formatProjectContexts, listProjectContexts } from "../../src/talend/project-contexts";
import type { ProjectContext } from "../../src/talend/project-contexts";

describe("project contexts", () => {
  test("lista los contextos de todos los jobs del proyecto", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-project-contexts-"));
    const projectPath = join(tempRoot, "project");
    const processDir = join(projectPath, "process");
    mkdirSync(processDir, { recursive: true });

    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties", join(processDir, "lab04_olist_orders_to_staging_0.1.properties"));
    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item", join(processDir, "lab04_olist_orders_to_staging_0.1.item"));

    await createTalendJob(projectPath, {
      jobName: "job_vacio",
      version: "0.1",
      defaultContext: "Default",
      folderPath: "carpeta_nueva",
    });

    const contexts = await listProjectContexts(projectPath);

    expect(contexts.some((entry: ProjectContext) => entry.jobName === "lab04_olist_orders_to_staging" && entry.contextName === "Default")).toBe(true);
    expect(contexts.some((entry: ProjectContext) => entry.jobName === "job_vacio" && entry.contextName === "Default")).toBe(true);

    const formatted = formatProjectContexts(contexts);
    expect(formatted).toContain("lab04_olist_orders_to_staging");
    expect(formatted).toContain("DB_HOST");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
