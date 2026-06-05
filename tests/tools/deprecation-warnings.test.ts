import { test, expect, describe } from "bun:test";
import { wrapHandlerWithDeprecationWarning, DEPRECATION_REMOVAL_DATE } from "../../src/server/tool-registry";
import { defineTool, type ToolContext } from "../../src/server/tool-definition";
import type { TalendToolDefinition } from "../../src/server/tool-definition";
import { okResult } from "../../src/presentation/tools/common/result";
import * as z from "zod/v4";

const TestInput = z.object({ test: z.string() });
type TestInput = z.infer<typeof TestInput>;

const TestOutput = z.object({ result: z.string() });
type TestOutput = z.infer<typeof TestOutput>;

function createMockTool(name: string): TalendToolDefinition<TestInput, TestOutput> {
  return defineTool({
    name,
    title: "Test Tool",
    description: "A test tool",
    category: "test",
    inputSchema: TestInput,
    outputSchema: TestOutput,
    safety: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
      requiresConfirmation: false,
      risk: "low",
    },
    async handler(_input: TestInput, _ctx: ToolContext) {
      return okResult({ result: "ok" }, "test-source", "high");
    },
  });
}

describe("Deprecation wrapper", () => {
  test("legacy tool returns warning in result", async () => {
    const legacyTool = createMockTool("legacy_list_jobs");
    const canonicalName = "talend_jobs_list";
    const wrapped = wrapHandlerWithDeprecationWarning(legacyTool, canonicalName);

    const mockCtx: ToolContext = {
      projectPath: undefined,
      workspacePath: undefined,
      platformCtx: {
        runtimeOs: "macos",
        talendHostOs: "macos",
        pathMode: "native",
      },
    };

    const result = await wrapped.handler({ test: "value" }, mockCtx);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });

  test("warning includes the new tool name", async () => {
    const legacyTool = createMockTool("talend_list_jobs");
    const canonicalName = "talend_jobs_list";
    const wrapped = wrapHandlerWithDeprecationWarning(legacyTool, canonicalName);

    const mockCtx: ToolContext = {
      projectPath: undefined,
      workspacePath: undefined,
      platformCtx: {
        runtimeOs: "macos",
        talendHostOs: "macos",
        pathMode: "native",
      },
    };

    const result = await wrapped.handler({ test: "value" }, mockCtx);
    const warning = result.warnings![0];

    expect(warning).toContain(canonicalName);
  });

  test("warning includes the removal date", async () => {
    const legacyTool = createMockTool("talend_old_tool");
    const canonicalName = "talend_new_tool";
    const wrapped = wrapHandlerWithDeprecationWarning(legacyTool, canonicalName);

    const mockCtx: ToolContext = {
      projectPath: undefined,
      workspacePath: undefined,
      platformCtx: {
        runtimeOs: "macos",
        talendHostOs: "macos",
        pathMode: "native",
      },
    };

    const result = await wrapped.handler({ test: "value" }, mockCtx);
    const warning = result.warnings![0];

    expect(warning).toContain(DEPRECATION_REMOVAL_DATE);
  });

  test("wrapped handler preserves original tool behavior", async () => {
    const legacyTool = createMockTool("legacy_tool");
    const wrapped = wrapHandlerWithDeprecationWarning(legacyTool, "canonical_tool");

    const mockCtx: ToolContext = {
      projectPath: undefined,
      workspacePath: undefined,
      platformCtx: {
        runtimeOs: "macos",
        talendHostOs: "macos",
        pathMode: "native",
      },
    };

    const result = await wrapped.handler({ test: "value" }, mockCtx);

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ result: "ok" });
  });

  test("preserves existing warnings from original handler", async () => {
    const originalTool = defineTool({
      name: "tool_with_existing_warning",
      title: "Tool with existing warning",
      description: "A tool that already has warnings",
      category: "test",
      inputSchema: TestInput,
      outputSchema: TestOutput,
      safety: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
        requiresConfirmation: false,
        risk: "low",
      },
      async handler(_input: TestInput, _ctx: ToolContext) {
        return okResult({ result: "ok" }, "test-source", "high", { warnings: ["Original warning"] });
      },
    });

    const wrapped = wrapHandlerWithDeprecationWarning(originalTool, "new_tool");

    const mockCtx: ToolContext = {
      projectPath: undefined,
      workspacePath: undefined,
      platformCtx: {
        runtimeOs: "macos",
        talendHostOs: "macos",
        pathMode: "native",
      },
    };

    const result = await wrapped.handler({ test: "value" }, mockCtx);

    expect(result.warnings).toContain("Original warning");
    expect(result.warnings).toContain(`La tool tool_with_existing_warning es legacy. Usa new_tool. Será removida después de ${DEPRECATION_REMOVAL_DATE}.`);
  });
});