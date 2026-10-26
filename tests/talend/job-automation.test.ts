import { describe, expect, test } from "bun:test";
import type { TalendStudioBridgeClient } from "../../src/talend/studio/bridge-client";
import { validateJobAutomation } from "../../src/talend/automation/job-automation";

/** Bridge minimo: solo lo que usa `validateJobAutomation`. */
function fakeBridge(options: {
  modelOk?: boolean;
  markersOk?: boolean;
  markers?: unknown[];
}): TalendStudioBridgeClient {
  return {
    activeJobModel: async () => ({ ok: options.modelOk ?? true }),
    problemsMarkers: async () => ({
      ok: options.markersOk ?? true,
      data: { markers: options.markers ?? [] },
    }),
  } as unknown as TalendStudioBridgeClient;
}

describe("automatizacion de jobs: validacion", () => {
  test("sin bridge devuelve el error de disponibilidad", async () => {
    const result = await validateJobAutomation("/proyecto", "MiJob");

    expect(result).toEqual({ ok: false, problemsCount: 0, errors: ["Bridge no disponible"] });
  });

  test("si Studio no entrega el modelo del job, falla", async () => {
    const result = await validateJobAutomation("/proyecto", "MiJob", fakeBridge({ modelOk: false }));

    expect(result.ok).toBe(false);
    expect(result.problemsCount).toBe(0);
    expect(result.errors).toEqual(["No se pudo obtener el modelo del job"]);
  });

  test("cuenta los marcadores de problemas del job", async () => {
    const result = await validateJobAutomation(
      "/proyecto",
      "MiJob",
      fakeBridge({ markers: [{}, {}] }),
    );

    expect(result).toEqual({ ok: true, problemsCount: 2, errors: [] });
  });

  test("si los marcadores fallan, el job queda sin problemas contados", async () => {
    const result = await validateJobAutomation(
      "/proyecto",
      "MiJob",
      fakeBridge({ markersOk: false, markers: [{}, {}] }),
    );

    expect(result).toEqual({ ok: true, problemsCount: 0, errors: [] });
  });
});
