import { AsyncLocalStorage } from "node:async_hooks";

export type RequestMetadata = { idempotencyKey?: string };

const requestContext = new AsyncLocalStorage<RequestMetadata>();

export function withRequestMetadata<T>(metadata: RequestMetadata, action: () => Promise<T>): Promise<T> {
  return requestContext.run(metadata, action);
}

export function getRequestMetadata(): RequestMetadata {
  return requestContext.getStore() ?? {};
}

/** Lee la clave desde los metadatos MCP del contexto de la llamada (stdio/SDK). */
export function idempotencyKeyFromMcpContext(context: unknown): string | undefined {
  if (!context || typeof context !== "object") return undefined;
  const value = context as Record<string, unknown>;
  const nested = [value.meta, value._meta, value.mcpReq, value.requestInfo]
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  for (const item of nested) {
    const metadata = [item._meta, item.meta].find((candidate) => candidate && typeof candidate === "object");
    const meta = metadata ? metadata as Record<string, unknown> : item;
    const key = meta.idempotencyKey ?? meta["idempotency-key"];
    if (typeof key === "string") return key;
  }
  return undefined;
}
