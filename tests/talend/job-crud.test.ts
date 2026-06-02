import { describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readTextFile } from "../../src/talend/files";
import { parseJobProperties } from "../../src/talend/repository";
import { parseJobItem } from "../../src/talend/job-parser";
import { createTalendJob, moveTalendJobToFolder } from "../../src/talend/job-crud";
import { listJobs } from "../../src/talend/repository";

describe("Talend job CRUD", () => {
  test("parseJobProperties resuelve href relativo del item", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");
    const resource = parseJobProperties(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");

    expect(resource.label).toBe("lab04_olist_orders_to_staging");
    expect(resource.version).toBe("0.1");
    expect(resource.itemPath).toContain("lab04_olist_orders_to_staging_0.1.item");
    expect(resource.folderPath).toBe("bloque2_talend_base");
  });

  test("parseJobItem extrae el defaultContext del job", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const job = parseJobItem(xml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    expect(job.components.length).toBeGreaterThan(0);
    expect(job.connections.length).toBeGreaterThan(0);
  });

  test("un job item vacío tiene la estructura correcta", async () => {
    const { createEmptyJobItemXml } = await import("../../src/talend/job-crud");
    const xml = createEmptyJobItemXml({
      jobName: "test_job",
      version: "0.1",
      defaultContext: "Default",
    });

    expect(xml).toContain("talendfile:ProcessType");
    expect(xml).toContain('jobType="Standard"');
    expect(xml).toContain('defaultContext="Default"');
  });

  test("un job properties vacío tiene la estructura correcta", async () => {
    const { createEmptyJobPropertiesXml } = await import("../../src/talend/job-crud");
    const xml = createEmptyJobPropertiesXml({
      label: "test_job",
      version: "0.1",
      itemFileName: "test_job_0.1.item",
    });

    expect(xml).toContain("TalendProperties:Property");
    expect(xml).toContain('label="test_job"');
    expect(xml).toContain("test_job_0.1.item");
  });

  test("listJobs incluye jobs dentro de subcarpetas", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-job-list-"));
    const projectPath = join(tempRoot, "project");
    const nestedDir = join(projectPath, "process", "carpeta_a", "subcarpeta_b");
    mkdirSync(nestedDir, { recursive: true });

    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties", join(nestedDir, "lab04_olist_orders_to_staging_0.1.properties"));
    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item", join(nestedDir, "lab04_olist_orders_to_staging_0.1.item"));

    const jobs = await listJobs(projectPath);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].folderPath).toBe("carpeta_a/subcarpeta_b");
    expect(jobs[0].itemPath).toContain("carpeta_a/subcarpeta_b/lab04_olist_orders_to_staging_0.1.item");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("moveTalendJobToFolder mueve item y properties y actualiza el path", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-job-move-"));
    const projectPath = join(tempRoot, "project");
    const processDir = join(projectPath, "process");
    mkdirSync(processDir, { recursive: true });

    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties", join(processDir, "lab04_olist_orders_to_staging_0.1.properties"));
    copyFileSync("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item", join(processDir, "lab04_olist_orders_to_staging_0.1.item"));

    const result = await moveTalendJobToFolder(projectPath, {
      jobName: "lab04_olist_orders_to_staging",
      folderPath: "carpeta_destino/subcarpeta",
    });

    expect(result.itemPath).toContain("process/carpeta_destino/subcarpeta/lab04_olist_orders_to_staging_0.1.item");
    expect(result.propertiesPath).toContain("process/carpeta_destino/subcarpeta/lab04_olist_orders_to_staging_0.1.properties");
    expect(existsSync(result.itemPath)).toBe(true);
    expect(existsSync(result.propertiesPath)).toBe(true);

    const propiedades = readFileSync(result.propertiesPath, "utf8");
    expect(propiedades).toContain('path="carpeta_destino/subcarpeta"');

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("createTalendJob puede crear jobs dentro de una carpeta", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-job-create-"));
    const projectPath = join(tempRoot, "project");

    const result = await createTalendJob(projectPath, {
      jobName: "nuevo_job",
      version: "0.1",
      defaultContext: "Default",
      folderPath: "carpeta_nueva",
    });

    expect(result.itemPath).toContain("process/carpeta_nueva/nuevo_job_0.1.item");
    expect(result.propertiesPath).toContain("process/carpeta_nueva/nuevo_job_0.1.properties");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
