import { describe, expect, test } from "bun:test";

import { asegurarJobVacio } from "../../scripts/l5/job-mounter";
import type { Bridge } from "../../scripts/l5/scenario-types";

function bridgeMock(overrides: Record<string, unknown>): Bridge {
  return overrides as unknown as Bridge;
}

const ok = <T>(data: T) => ({ ok: true as const, data });

describe("limpieza de modelos viejos del job L5", () => {
  test("acepta un job nuevo que ya esta vacio", async () => {
    let deletes = 0;
    const bridge = bridgeMock({
      listNodes: async () => ok([]),
      deleteJob: async () => { deletes++; return ok({}); },
      createJob: async () => ok({}),
      openJob: async () => ok({}),
    });

    expect(await asegurarJobVacio(bridge, "MCP_L5_Test")).toEqual({ ok: true });
    expect(deletes).toBe(0);
  });

  test("borra y recrea una vez si Studio muestra nodos anteriores", async () => {
    let reads = 0;
    const calls: string[] = [];
    const bridge = bridgeMock({
      listNodes: async () => {
        reads++;
        return ok(reads === 1 ? [{ uniqueName: "tFixedFlowInput_1" }] : []);
      },
      deleteJob: async () => { calls.push("delete"); return ok({}); },
      createJob: async () => { calls.push("create"); return ok({}); },
      openJob: async () => { calls.push("open"); return ok({}); },
    });

    expect(await asegurarJobVacio(bridge, "MCP_L5_Test")).toEqual({ ok: true });
    expect(calls).toEqual(["delete", "create", "open"]);
    expect(reads).toBe(2);
  });

  test("falla con instrucciones claras si los nodos viejos persisten", async () => {
    let reads = 0;
    const bridge = bridgeMock({
      listNodes: async () => {
        reads++;
        return ok([{ uniqueName: "tMap_1" }]);
      },
      deleteJob: async () => ok({}),
      createJob: async () => ok({}),
      openJob: async () => ok({}),
    });

    const resultado = await asegurarJobVacio(bridge, "MCP_L5_Test");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("Studio no cerro el editor del Job");
    expect(resultado.mensaje).toContain("tMap_1");
    expect(reads).toBe(2);
  });

  test("no recrea si no puede inspeccionar el job", async () => {
    let creates = 0;
    const bridge = bridgeMock({
      listNodes: async () => ({ ok: false, error: { message: "bridge no disponible" } }),
      deleteJob: async () => ok({}),
      createJob: async () => { creates++; return ok({}); },
      openJob: async () => ok({}),
    });

    const resultado = await asegurarJobVacio(bridge, "MCP_L5_Test");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("no se pudieron listar");
    expect(creates).toBe(0);
  });
});
