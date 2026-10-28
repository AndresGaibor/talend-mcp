import { describe, expect, test } from "bun:test";
import { decideRestart, RESTART_RECOMMENDED_PERCENT } from "../../src/talend/studio/studio-restart";

const base = { platform: "win32", readOnly: false };

describe("decideRestart", () => {
  test("reinicia cuando se pide sin umbral", () => {
    expect(decideRestart(base)).toEqual({ proceed: true });
  });

  test("rechaza con el bridge en solo lectura", () => {
    const decision = decideRestart({ ...base, readOnly: true });
    expect(decision.proceed).toBe(false);
    expect(decision.proceed === false && decision.code).toBe("STUDIO_RESTART_READONLY");
  });

  test("solo esta implementado en Windows", () => {
    const decision = decideRestart({ ...base, platform: "linux" });
    expect(decision.proceed === false && decision.code).toBe("STUDIO_RESTART_UNSUPPORTED");
  });

  test("no reinicia si la memoria no supera el umbral", () => {
    const decision = decideRestart({ ...base, usedPercent: 60, onlyIfMemoryAbove: RESTART_RECOMMENDED_PERCENT });
    expect(decision.proceed === false && decision.code).toBe("STUDIO_RESTART_NOT_NEEDED");
  });

  test("reinicia si la memoria supera el umbral", () => {
    expect(decideRestart({ ...base, usedPercent: 83, onlyIfMemoryAbove: RESTART_RECOMMENDED_PERCENT })).toEqual({ proceed: true });
  });

  test("con la memoria desconocida (Studio colgado) reinicia aunque haya umbral", () => {
    expect(decideRestart({ ...base, onlyIfMemoryAbove: RESTART_RECOMMENDED_PERCENT })).toEqual({ proceed: true });
  });
});
