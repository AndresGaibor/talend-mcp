import { describe, expect, test } from "bun:test";
import { classifyStudioState, type StudioProbe } from "../../src/talend/studio/studio-state";

const base: StudioProbe = {
  pid: 100,
  pingOk: true,
  modalTitles: [],
  loginScreen: false,
  runningJob: false,
};

describe("classifyStudioState", () => {
  test("sin proceso: NOT_RUNNING", () => {
    expect(classifyStudioState({ ...base, pid: undefined, pingOk: false }).state).toBe("NOT_RUNNING");
  });

  test("proceso en la pantalla de login: WAITING_LOGIN", () => {
    expect(classifyStudioState({ ...base, pingOk: false, loginScreen: true }).state).toBe("WAITING_LOGIN");
  });

  test("proceso sin bridge y sin login: BRIDGE_DEAD", () => {
    expect(classifyStudioState({ ...base, pingOk: false }).state).toBe("BRIDGE_DEAD");
  });

  test("dialogo abierto: MODAL_BLOCKING y el motivo nombra el titulo", () => {
    const r = classifyStudioState({ ...base, modalTitles: ["Network Issue"] });
    expect(r.state).toBe("MODAL_BLOCKING");
    expect(r.reason).toContain("Network Issue");
  });

  test("compilacion o ejecucion en curso: BUSY", () => {
    expect(classifyStudioState({ ...base, runningJob: true }).state).toBe("BUSY");
  });

  test("el dialogo gana a la ocupacion", () => {
    expect(classifyStudioState({ ...base, runningJob: true, modalTitles: ["x"] }).state).toBe("MODAL_BLOCKING");
  });

  test("todo en orden: READY", () => {
    expect(classifyStudioState(base).state).toBe("READY");
  });
});
