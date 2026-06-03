import { describe, it, expect } from "bun:test";
import { getLiveTalendState, updateLiveTalendState, resetLiveTalendState } from "../../src/talend/live/state";

describe("live-state", () => {
  describe("getLiveTalendState", () => {
    it("devuelve estado inicial con warnings", () => {
      const state = getLiveTalendState();
      expect(state).toBeDefined();
      expect(Array.isArray(state.warnings)).toBe(true);
      expect(state.startedAt).toBeDefined();
    });
  });

  describe("updateLiveTalendState", () => {
    it("actualiza parcialmente el estado", () => {
      resetLiveTalendState();
      const updated = updateLiveTalendState({
        projectPath: "/test/path",
        projectName: "TEST_PROJECT",
      });
      expect(updated.projectPath).toBe("/test/path");
      expect(updated.projectName).toBe("TEST_PROJECT");
    });
  });

  describe("resetLiveTalendState", () => {
    it("resetea el estado a defaults", () => {
      resetLiveTalendState();
      const state = getLiveTalendState();
      expect(state.projectPath).toBeUndefined();
      expect(state.projectName).toBeUndefined();
    });
  });
});