import type { TalendResult } from "../contracts/result.contract";

export type McpToolResponse<T = unknown> = {
  structuredContent: TalendResult<T>;
  content: Array<{ type: "text"; text: string }>;
  _meta?: {
    ui?: {
      resourceUri?: string;
      visibility?: Array<"model" | "app">;
      csp?: {
        connectDomains?: string[];
        resourceDomains?: string[];
        frameDomains?: string[];
      };
    };
    "openai/outputTemplate"?: string;
    "openai/widgetAccessible"?: boolean;
    [key: string]: unknown;
  };
};

export function toMcpResult<T>(
  result: TalendResult<T>,
  options?: {
    text?: string;
    meta?: Record<string, unknown>;
    resourceUri?: string;
  },
): McpToolResponse<T> {
  const text = options?.text ?? JSON.stringify(result, null, 2);
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
    ...(options?.meta || options?.resourceUri
      ? {
          _meta: {
            ...(options.resourceUri
              ? {
                  ui: {
                    resourceUri: options.resourceUri,
                    visibility: ["model", "app"],
                  },
                  "openai/outputTemplate": options.resourceUri,
                  "openai/widgetAccessible": true,
                }
              : {}),
            ...(options.meta ?? {}),
          },
        }
      : {}),
  };
}
