import { test, expect, describe } from "bun:test";
import {
  GENERIC_TOOL_OUTPUT_SCHEMA,
  getRegisteredServerTools,
  getRegisteredServerToolCount,
  getRegisteredServerToolAnnotations,
} from "../../src/presentation/server/tool-registry";

describe("Tool Registry", () => {
  const tools = getRegisteredServerTools();

  test("expone las tools registradas", () => {
    expect(tools.length).toBeGreaterThan(0);
    expect(getRegisteredServerToolCount()).toBe(tools.length);
  });

  test("toda tool tiene inputSchema y outputSchema", () => {
    const sinSchema = tools.filter((tool) => tool.inputSchema === undefined || tool.outputSchema === undefined);
    expect(sinSchema.map((tool) => tool.name)).toEqual([]);
  });

  test("el outputSchema generico esta bien definido", () => {
    const shape = GENERIC_TOOL_OUTPUT_SCHEMA.shape as Record<string, unknown>;
    expect(GENERIC_TOOL_OUTPUT_SCHEMA.type).toBe("object");
    expect(shape.ok).toBeDefined();
    expect(shape.source).toBeDefined();
  });

  test("las anotaciones de seguridad son booleanas", () => {
    for (const tool of tools) {
      const annotations = getRegisteredServerToolAnnotations(tool.name);
      expect(typeof annotations.readOnlyHint).toBe("boolean");
      expect(typeof annotations.idempotentHint).toBe("boolean");
      expect(typeof annotations.destructiveHint).toBe("boolean");
      expect(typeof annotations.openWorldHint).toBe("boolean");
    }
  });

  test("las tools de solo lectura son idempotentes y no destructivas", () => {
    for (const tool of tools) {
      const annotations = getRegisteredServerToolAnnotations(tool.name);
      if (!annotations.readOnlyHint) continue;
      expect(annotations.idempotentHint, `${tool.name} es readOnly pero no idempotente`).toBe(true);
      expect(annotations.destructiveHint, `${tool.name} es readOnly pero destructiva`).toBe(false);
    }
  });

  test("las tools destructivas no son readOnly", () => {
    for (const tool of tools) {
      const annotations = getRegisteredServerToolAnnotations(tool.name);
      if (!annotations.destructiveHint) continue;
      expect(annotations.readOnlyHint, `${tool.name} es destructiva pero readOnly`).toBe(false);
    }
  });
});
