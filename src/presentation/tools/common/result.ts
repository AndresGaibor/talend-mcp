export type { TalendResult as TalendToolResult, Confidence } from "../../../shared/contracts/result.contract";
export { okResult, errorResult, warningResult } from "../../../shared/contracts/result.contract";
import { errorResult } from "../../../shared/contracts/result.contract";
import type { TalendResult } from "../../../shared/contracts/result.contract";

export function toTalendToolResult<T>(
  result: TalendResult<T> | unknown
): TalendResult<T> {
  if (result && typeof result === "object" && "ok" in result) {
    return result as TalendResult<T>;
  }
  return errorResult("unknown", "INVALID_RESULT", "Resultado no es un TalendToolResult válido");
}