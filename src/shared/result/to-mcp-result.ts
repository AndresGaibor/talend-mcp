import type { TalendResult } from "./talend-result";

export function toMcpResult(
  result: TalendResult<unknown>
): { structuredContent: TalendResult<unknown>; content: Array<{ type: "text"; text: string }> } {
  const text = JSON.stringify(result, null, 2);
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
}
