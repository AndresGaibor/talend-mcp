import { describe, expect, test } from "bun:test";
import { interpretLaunchWait } from "../../src/talend/studio/launch-wait-outcome";

/**
 * Contrato de `/launch/wait`: el bridge responde `ok: true` tambien cuando el
 * job sigue corriendo al expirar el timeout. Estos casos fijan que `terminated`
 * solo sea verdadero cuando el bridge lo confirma.
 */
describe("interpretLaunchWait", () => {
  test("terminado: el bridge confirma terminatedAt", () => {
    const outcome = interpretLaunchWait("launch_1", {
      terminated: true,
      status: "success",
      exitCode: 0,
      durationMs: 4200,
    });
    expect(outcome).toEqual({
      launchId: "launch_1",
      terminated: true,
      timedOut: false,
      status: "success",
      exitCode: 0,
      durationMs: 4200,
    });
  });

  test("expirado: timedOut no cuenta como terminado aunque el ok sea true", () => {
    const outcome = interpretLaunchWait("launch_2", { ok: true, timedOut: true, status: "started" });
    expect(outcome.terminated).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.status).toBe("started");
    expect(outcome.exitCode).toBeNull();
  });

  test("respuesta de un bridge antiguo sin campos: no se asume terminado", () => {
    const outcome = interpretLaunchWait("launch_3", undefined);
    expect(outcome.terminated).toBe(false);
    expect(outcome.timedOut).toBe(false);
    expect(outcome.status).toBe("started");
  });

  test("terminated false sin timedOut (estado del bridge) no se confunde con terminado", () => {
    const outcome = interpretLaunchWait("launch_4", { terminated: false, status: "unobserved" });
    expect(outcome.terminated).toBe(false);
    expect(outcome.status).toBe("unobserved");
  });
});
