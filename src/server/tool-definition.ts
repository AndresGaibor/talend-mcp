import * as z from "zod/v4";
import type { PlatformContext } from "../platform/platform-context";
import type { TalendResult } from "../shared/result/talend-result";

export type ToolRisk = "low" | "medium" | "high";

export type ToolSafety = {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  requiresWorkspace?: boolean;
  requiresConfirmation?: boolean;
  risk: ToolRisk;
};

export type ToolContext = {
  projectPath: string | undefined;
  workspacePath: string | undefined;
  platformCtx: PlatformContext;
};

export type TalendToolDefinition<I, O> = {
  name: string;
  title: string;
  description: string;
  category: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  safety: ToolSafety;
  handler(input: I, ctx: ToolContext): Promise<TalendResult<O>>;
};

export function defineTool<I, O>(
  definition: TalendToolDefinition<I, O>
): TalendToolDefinition<I, O> {
  return definition;
}
