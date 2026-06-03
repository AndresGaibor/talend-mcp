import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { listLaunchConfigs } from "../../src/talend/studio/launch-configs";

const FIXTURES = join(__dirname, "..", "fixtures", "talend");

describe("launch-configs", () => {
  describe("listLaunchConfigs", () => {
    it("devuelve launch configs desde workspace con fixtures", async () => {
      const wsMetaPath = join(FIXTURES, "workspace", ".metadata");
      const result = await listLaunchConfigs(wsMetaPath);
      expect(result.ok).toBe(true);
      expect(result.confidence).toBe("medium");
    });

    it("devuelve error si no existe el directorio de launches", async () => {
      const result = await listLaunchConfigs("/ruta/inexistente/.metadata");
      expect(result.ok).toBe(false);
      expect(result.confidence).toBe("none");
    });
  });
});