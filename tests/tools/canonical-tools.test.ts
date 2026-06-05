import { test, expect, describe } from "bun:test";
import { getAllRuntimeTools, getLegacyAliases } from "../../src/server/registered-tools";
import type { McpToolDefinition } from "../../src/server/adapt-tool";

describe("Canonical Tools", () => {
  const tools = getAllRuntimeTools();
  const aliases = getLegacyAliases();

  const isValidTool = (t: McpToolDefinition): boolean =>
    typeof t?.name === "string" && t.name.length > 0;

  const toolsValidos = tools.filter(isValidTool);

  describe("1. All tools have inputSchema", () => {
    test("every valid tool has a non-undefined inputSchema", () => {
      const sinSchema = toolsValidos.filter((t) => t.inputSchema === undefined);
      expect(sinSchema, `Herramientas sin inputSchema: ${sinSchema.map((t) => t.name).join(", ")}`).toHaveLength(0);
    });

    test("inputSchema is object, string, or zod when defined", () => {
      const invalidos = toolsValidos.filter((t) => {
        const schema = t.inputSchema;
        if (schema === undefined) return false;
        const tipo = typeof schema;
        return tipo !== "object" && tipo !== "string" && schema !== "zod";
      });
      expect(
        invalidos,
        `inputSchema con tipo inválido en: ${invalidos.map((t) => `${t.name}(${typeof t.inputSchema})`).join(", ")}`,
      ).toHaveLength(0);
    });

    test("inputSchema object has type property", () => {
      const sinTipo = toolsValidos.filter((t) => {
        const schema = t.inputSchema as Record<string, unknown> | null;
        if (schema === undefined) return false;
        if (typeof schema !== "object" || schema === null) return false;
        return !("type" in schema);
      });
      expect(
        sinTipo,
        `inputSchema sin propiedad 'type' en: ${sinTipo.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });
  });

  describe("2. All tools have outputSchema", () => {
    test("every valid tool has outputSchema defined", () => {
      const sinOutput = toolsValidos.filter((t) => t.outputSchema === undefined);
      expect(
        sinOutput,
        `Herramientas sin outputSchema: ${sinOutput.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("outputSchema is object, string, or zod when defined", () => {
      const invalidos = toolsValidos.filter((t) => {
        const schema = t.outputSchema;
        if (schema === undefined) return false;
        const tipo = typeof schema;
        return tipo !== "object" && tipo !== "string" && schema !== "zod";
      });
      expect(
        invalidos,
        `outputSchema con tipo inválido en: ${invalidos.map((t) => `${t.name}(${typeof t.outputSchema})`).join(", ")}`,
      ).toHaveLength(0);
    });
  });

  describe("3. All tools have safety annotations", () => {
    test("every valid tool has annotations defined", () => {
      const sinAnnotations = toolsValidos.filter((t) => t.annotations === undefined);
      expect(
        sinAnnotations,
        `Herramientas sin annotations: ${sinAnnotations.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("annotations have destructiveHint or readOnlyHint", () => {
      const invalidos = toolsValidos.filter((t) => {
        const ann = t.annotations;
        if (!ann) return true;
        return ann.destructiveHint === undefined && ann.readOnlyHint === undefined;
      });
      expect(
        invalidos,
        `Annotations sin destructiveHint ni readOnlyHint en: ${invalidos.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("destructiveHint is boolean when defined", () => {
      const invalidos = toolsValidos.filter((t) => {
        const ann = t.annotations;
        if (!ann || ann.destructiveHint === undefined) return false;
        return typeof ann.destructiveHint !== "boolean";
      });
      expect(
        invalidos,
        `destructiveHint no es boolean en: ${invalidos.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("readOnlyHint is boolean when defined", () => {
      const invalidos = toolsValidos.filter((t) => {
        const ann = t.annotations;
        if (!ann || ann.readOnlyHint === undefined) return false;
        return typeof ann.readOnlyHint !== "boolean";
      });
      expect(
        invalidos,
        `readOnlyHint no es boolean en: ${invalidos.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });
  });

  describe("4. All legacy aliases point to existing canonical tools", () => {
    test("all alias targets exist as canonical tool names", () => {
      const toolNames = new Set(toolsValidos.map((t) => t.name));
      const errores: string[] = [];

      for (const [alias, target] of aliases.entries()) {
        if (!toolNames.has(target)) {
          errores.push(`${alias} -> ${target} (no existe)`);
        }
      }

      expect(
        errores,
        `Alias con targets inexistentes:\n${errores.join("\n")}`,
      ).toHaveLength(0);
    });

    test("alias names do not shadow actual tool names", () => {
      const canonicalToolNames = new Set(toolsValidos.map((t) => t.name).filter((name) => !aliases.has(name)));
      const duplicados = [...aliases.keys()].filter((k) => canonicalToolNames.has(k));

      expect(
        duplicados,
        `Alias que chocan con herramientas reales: ${duplicados.join(", ")}`,
      ).toHaveLength(0);
    });
  });

  describe("5. All destructive tools require confirmation", () => {
    const DESTRUCTIVE_VERBS = ["create", "apply", "patch", "restore", "delete"];

    function esDestructivo(nombre: string): boolean {
      const lower = nombre.toLowerCase();
      return DESTRUCTIVE_VERBS.some((v) => lower.includes(v));
    }

    test("destructive tools have requiresConfirmation: true", () => {
      const destructivos = toolsValidos.filter((t) => {
        const ann = t.annotations;
        if (!ann) return false;
        return ann.destructiveHint === true || esDestructivo(t.name);
      });

      const sinConfirm: string[] = [];
      for (const t of destructivos) {
        const ann = t.annotations!;
        if (ann.requiresConfirmation !== true) {
          sinConfirm.push(`${t.name} (requiresConfirmation=${ann.requiresConfirmation})`);
        }
      }

      expect(
        sinConfirm,
        `Herramientas destructivas sin requiresConfirmation:\n${sinConfirm.join("\n")}`,
      ).toHaveLength(0);
    });

    test("create tools require confirmation", () => {
      const creadores = toolsValidos.filter((t) => t.name.toLowerCase().includes("create"));
      const sinConfirm = creadores.filter((t) => t.annotations?.requiresConfirmation !== true);

      expect(
        sinConfirm,
        `Herramientas create sin requiresConfirmation: ${sinConfirm.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("apply tools require confirmation", () => {
      const aplicadores = toolsValidos.filter((t) => t.name.toLowerCase().includes("apply"));
      const sinConfirm = aplicadores.filter((t) => t.annotations?.requiresConfirmation !== true);

      expect(
        sinConfirm,
        `Herramientas apply sin requiresConfirmation: ${sinConfirm.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("patch tools require confirmation", () => {
      const parcheadores = toolsValidos.filter((t) => t.name.toLowerCase().includes("patch"));
      const sinConfirm = parcheadores.filter((t) => t.annotations?.requiresConfirmation !== true);

      expect(
        sinConfirm,
        `Herramientas patch sin requiresConfirmation: ${sinConfirm.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("restore tools require confirmation", () => {
      const restauradores = toolsValidos.filter((t) => t.name.toLowerCase().includes("restore"));
      const sinConfirm = restauradores.filter((t) => t.annotations?.requiresConfirmation !== true);

      expect(
        sinConfirm,
        `Herramientas restore sin requiresConfirmation: ${sinConfirm.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });

    test("delete tools require confirmation", () => {
      const eliminadores = toolsValidos.filter((t) => t.name.toLowerCase().includes("delete"));
      const sinConfirm = eliminadores.filter((t) => t.annotations?.requiresConfirmation !== true);

      expect(
        sinConfirm,
        `Herramientas delete sin requiresConfirmation: ${sinConfirm.map((t) => t.name).join(", ")}`,
      ).toHaveLength(0);
    });
  });
});
