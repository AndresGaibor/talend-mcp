import { describe, expect, test } from "bun:test";

import { idempotencyKeyFromMcpContext, withRequestMetadata, getRequestMetadata } from "../../src/presentation/server/new-server/request-context";

describe("metadatos de solicitud MCP", () => {
  test("lee la clave idempotente de contextos del SDK y alias de metadatos HTTP", () => {
    expect(idempotencyKeyFromMcpContext({ meta: { idempotencyKey: "stdio-key-0001" } })).toBe("stdio-key-0001");
    expect(idempotencyKeyFromMcpContext({ _meta: { "idempotency-key": "stdio-key-0002" } })).toBe("stdio-key-0002");
    expect(idempotencyKeyFromMcpContext({ mcpReq: { _meta: { idempotencyKey: "sdk-key-0003" } } })).toBe("sdk-key-0003");
    expect(idempotencyKeyFromMcpContext({ meta: { unrelated: true } })).toBeUndefined();
  });

  test("mantiene aislados los metadatos de requests concurrentes", async () => {
    const values = await Promise.all(["http-key-0001", "http-key-0002"].map((idempotencyKey) =>
      withRequestMetadata({ idempotencyKey }, async () => {
        await Promise.resolve();
        return getRequestMetadata().idempotencyKey;
      }),
    ));
    expect(values).toEqual(["http-key-0001", "http-key-0002"]);
  });
});
