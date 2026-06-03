import { describe, it, expect } from "bun:test";
import { diagnoseJob } from "../../src/talend/diagnostics/job-diagnostics";

describe("job-diagnostics", () => {
  describe("diagnoseJob", () => {
    it("devuelve error si no hay TALEND_PROJECT configurado", async () => {
      const before = process.env.TALEND_PROJECT;
      delete process.env.TALEND_PROJECT;
      const result = await diagnoseJob();
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
      expect(result.error).toContain("TALEND_PROJECT");
      if (before) process.env.TALEND_PROJECT = before;
    });

    it("devuelve error si no se puede detectar job activo y none fue proporcionado", async () => {
      process.env.TALEND_PROJECT = "/ruta/inexistente";
      const result = await diagnoseJob();
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
      delete process.env.TALEND_PROJECT;
    });
  });
});