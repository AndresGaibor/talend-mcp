export function wrapHandler<T extends (...args: never[]) => Promise<unknown>>(handlerOrName: T | string, maybeHandler?: T): T {
  if (typeof handlerOrName === "string") return maybeHandler as T;
  return handlerOrName;
}