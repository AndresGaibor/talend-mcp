import { describe, expect, test } from "bun:test";
import type { ServerResponse } from "node:http";

import { handleMcpRequest, jsonRpcError, jsonRpcOk } from "../../src/presentation/server/json-rpc";

/** Respuesta falsa: guarda estado y cuerpo sin abrir un socket. */
function fakeResponse() {
  const captured = { status: 0, headers: {} as Record<string, unknown>, body: "" };
  const res = {
    writeHead(status: number, headers: Record<string, unknown>) {
      captured.status = status;
      captured.headers = headers;
      return res;
    },
    end(chunk?: string) {
      captured.body = chunk ?? "";
      return res;
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

describe("respuestas JSON-RPC del servidor HTTP", () => {
  test("arma respuestas correctas y conserva el id nulo", () => {
    expect(jsonRpcOk(7, { ok: true })).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: { ok: true },
    });
    expect(jsonRpcError(null, -32601, "Method not found")).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32601, message: "Method not found" },
    });
  });

  test("initialize devuelve instrucciones y capacidades", () => {
    const { res, captured } = fakeResponse();
    const handled = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize" }, undefined, res, "[]");

    expect(handled).toBe(true);
    expect(captured.status).toBe(200);
    const payload = JSON.parse(captured.body);
    expect(payload.id).toBe(1);
    expect(payload.result.serverInfo.name).toBe("talend-mcp");
    expect(payload.result.capabilities.tools.listChanged).toBe(false);
    expect(typeof payload.result.instructions).toBe("string");
  });

  test("tools/list responde con el catalogo ya serializado", () => {
    const { res, captured } = fakeResponse();
    const toolsJson = '[{"name":"talend_guide"}]';
    const handled = handleMcpRequest({ id: 2, method: "tools/list" }, undefined, res, toolsJson);

    expect(handled).toBe(true);
    expect(captured.body).toBe(
      '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"talend_guide"}]}}',
    );
  });

  test("acusa notificaciones y ping sin cuerpo de resultado", () => {
    for (const method of ["notifications/initialized", "ping"]) {
      const { res, captured } = fakeResponse();
      expect(handleMcpRequest({ method }, undefined, res, "[]")).toBe(true);
      expect(captured.status).toBe(202);
      expect(captured.body).toBe("{}");
    }
  });

  test("deja tools/call al servidor y rechaza metodos desconocidos", () => {
    const call = fakeResponse();
    expect(handleMcpRequest({ id: 3, method: "tools/call" }, undefined, call.res, "[]")).toBe(false);
    expect(call.captured.status).toBe(0);

    const unknown = fakeResponse();
    expect(handleMcpRequest({ id: 4, method: "tools/nope" }, undefined, unknown.res, "[]")).toBe(true);
    expect(JSON.parse(unknown.captured.body).error.code).toBe(-32601);
  });

  test("responde listas vacias de recursos y prompts", () => {
    const resources = fakeResponse();
    handleMcpRequest({ id: 5, method: "resources/list" }, undefined, resources.res, "[]");
    expect(JSON.parse(resources.captured.body).result).toEqual({ resources: [] });

    const prompts = fakeResponse();
    handleMcpRequest({ id: 6, method: "prompts/list" }, undefined, prompts.res, "[]");
    expect(JSON.parse(prompts.captured.body).result).toEqual({ prompts: [] });
  });
});
