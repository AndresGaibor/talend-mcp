import { describe, it, expect, beforeEach } from "bun:test";
import { join } from "node:path";
import { parseWorkbenchState, findWorkbenchXmiFiles, getProbableActiveJob } from "../../src/talend/studio/workbench-xmi";
import { existsSync } from "node:fs";

const FIXTURES = join(__dirname, "..", "fixtures", "talend");

const PROJECT_PATH = join(FIXTURES, "workspace", "CAPACITACION_GL3-1327321152");

describe("workbench-xmi", () => {
  describe("findWorkbenchXmiFiles", () => {
    it("devuelve archivos xmi del workspace", async () => {
      const files = await findWorkbenchXmiFiles(join(FIXTURES, "workspace"));
      expect(Array.isArray(files)).toBe(true);
    });

    it("devuelve array vacío si no existe el directorio", async () => {
      const files = await findWorkbenchXmiFiles("/ruta/inexistente");
      expect(files).toEqual([]);
    });
  });

  describe("parseWorkbenchState", () => {
    it("devuelve error claro si no hay projectPath", async () => {
      const result = await parseWorkbenchState(undefined);
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
    });

    it("devuelve error cuando el workspace no tiene archivos xmi", async () => {
      const result = await parseWorkbenchState("/ruta/inexistente");
      expect(result.ok).toBe(false);
    });
  });

  describe("getProbableActiveJob", () => {
    it("devuelve error claro cuando no hay TALEND_PROJECT configurado", async () => {
      const before = process.env.TALEND_PROJECT;
      delete process.env.TALEND_PROJECT;
      const result = await getProbableActiveJob();
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
      if (before) process.env.TALEND_PROJECT = before;
    });
  });
});