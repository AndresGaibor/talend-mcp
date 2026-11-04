import { describe, expect, test } from "bun:test";
import { StudioStartError, waitForStudioBridge } from "../../src/talend/studio/studio-restart";

/** Reloj falso: `sleep` adelanta el tiempo, asi los plazos largos no hacen esperar al test. */
function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
  };
}

describe("waitForStudioBridge", () => {
  test("devuelve el pid en cuanto el bridge responde", async () => {
    const clock = fakeClock();
    let calls = 0;
    const pid = await waitForStudioBridge({
      timeoutMs: 60_000,
      intervalMs: 1_000,
      checkBridge: async () => (++calls >= 3 ? 4242 : undefined),
      isStudioRunning: async () => true,
      ...clock,
    });
    expect(pid).toBe(4242);
    expect(calls).toBe(3);
  });

  test("si Studio sigue abierto pero el bridge no responde, dice que espera el login", async () => {
    const clock = fakeClock();
    const error = await waitForStudioBridge({
      timeoutMs: 10_000,
      intervalMs: 1_000,
      checkBridge: async () => undefined,
      isStudioRunning: async () => true,
      ...clock,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(StudioStartError);
    expect((error as StudioStartError).code).toBe("STUDIO_WAITING_LOGIN");
    expect((error as StudioStartError).message.toLowerCase()).toContain("login");
  });

  test("si Studio desaparece lo dice en vez de esperar todo el plazo", async () => {
    const clock = fakeClock();
    const error = await waitForStudioBridge({
      timeoutMs: 300_000,
      intervalMs: 1_000,
      checkBridge: async () => undefined,
      isStudioRunning: async () => false,
      ...clock,
    }).catch((e) => e);
    expect((error as StudioStartError).code).toBe("STUDIO_EXITED");
    expect(clock.now()).toBeLessThan(10_000);
  });

  test("un solo fallo de deteccion del proceso no se toma por una caida", async () => {
    const clock = fakeClock();
    let running = 0;
    let calls = 0;
    const pid = await waitForStudioBridge({
      timeoutMs: 60_000,
      intervalMs: 1_000,
      checkBridge: async () => (++calls >= 3 ? 7 : undefined),
      isStudioRunning: async () => ++running !== 1,
      ...clock,
    });
    expect(pid).toBe(7);
  });

  test("no se pasa del plazo aunque cada comprobacion tarde", async () => {
    const clock = fakeClock();
    const error = await waitForStudioBridge({
      timeoutMs: 10_000,
      intervalMs: 1_000,
      checkBridge: async () => {
        await clock.sleep(4_000);
        return undefined;
      },
      isStudioRunning: async () => true,
      ...clock,
    }).catch((e) => e);
    expect((error as StudioStartError).code).toBe("STUDIO_WAITING_LOGIN");
    expect(clock.now()).toBeLessThanOrEqual(10_000 + 5_000);
  });
});
