import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { findExportedJobScripts } from "../../src/talend/runner/exported-job-finder";

const FIXTURES = join(__dirname, "..", "fixtures", "talend");

describe("exported-job-finder", () => {
  describe("findExportedJobScripts", () => {
    it("devuelve error claro si TALEND_BUILDS_DIR no está configurado", async () => {
      const before = process.env.TALEND_BUILDS_DIR;
      delete process.env.TALEND_BUILDS_DIR;
      const result = await findExportedJobScripts({});
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
      expect(result.error).toContain("TALEND_BUILDS_DIR");
      if (before) process.env.TALEND_BUILDS_DIR = before;
    });

    it("encuentra scripts en directorio de fixtures", async () => {
      const result = await findExportedJobScripts({ buildsDir: join(FIXTURES, "builds") });
      expect(result.ok).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it("filtra por jobName cuando se especifica", async () => {
      const result = await findExportedJobScripts({ buildsDir: join(FIXTURES, "builds"), jobName: "lab04_olist_orders_to_staging" });
      expect(result.ok).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it("devuelve error si no encuentra scripts", async () => {
      const result = await findExportedJobScripts({ buildsDir: join(FIXTURES, "builds"), jobName: "job_inexistente" });
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
    });
  });
});