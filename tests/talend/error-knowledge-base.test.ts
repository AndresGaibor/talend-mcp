import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeError,
  getErrorById,
  getErrorStats,
  getErrorsByCategory,
  getKnowledgeBase,
  suggestFix,
} from "../../src/talend/diagnostics/error-knowledge-base";

/**
 * Caracterizacion de la base de conocimiento con un directorio de trabajo
 * temporal por caso: cada prueba parte del catalogo inicial, sin el archivo
 * persistido de la maquina.
 */
function inTempDir<T>(fn: () => T): T {
  const dir = mkdtempSync(join(tmpdir(), "talend-kb-"));
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(previous);
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("error-knowledge-base", () => {
  test("getKnowledgeBase devuelve el catalogo inicial versionado", () => {
    inTempDir(() => {
      const kb = getKnowledgeBase();
      expect(kb.version).toBe(1);
      expect(kb.errors.length).toBe(10);
      expect(kb.errors.every((e) => e.occurrences === 0)).toBe(true);
    });
  });

  test("getErrorById encuentra por id y devuelve null si no existe", () => {
    inTempDir(() => {
      const err = getErrorById("context_param_not_found");
      expect(err?.category).toBe("context");
      expect(err?.canAutoFix).toBe(false);
      expect(getErrorById("no_existe")).toBeNull();
    });
  });

  test("getErrorsByCategory filtra por categoria", () => {
    inTempDir(() => {
      expect(getErrorsByCategory("database").map((e) => e.id)).toEqual([
        "no_suitable_driver",
        "column_not_found",
      ]);
      expect(getErrorsByCategory("design").every((e) => e.canAutoFix)).toBe(true);
      expect(getErrorsByCategory("inexistente")).toEqual([]);
    });
  });

  test("getErrorStats parte de cero ocurrencias y dos errores auto-corregibles", () => {
    inTempDir(() => {
      const stats = getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.autoFixable).toBe(2);
      expect(stats.byCategory.database).toBe(0);
    });
  });

  test("analyzeError registra la ocurrencia del error reconocido", () => {
    inTempDir(() => {
      const err = analyzeError("java.lang.NullPointerException at Job.run");
      expect(err?.id).toBe("null_pointer");
      expect(err?.occurrences).toBe(1);
      expect(getErrorStats().byCategory.runtime).toBe(1);
      expect(analyzeError("mensaje sin patron conocido")).toBeNull();
    });
  });

  test("suggestFix describe causa y solucion, y avisa si es auto-corregible", () => {
    inTempDir(() => {
      const known = suggestFix("Duplicate uniqueName T_MAP_1");
      expect(known.error?.id).toBe("duplicate_unique_name");
      expect(known.advice).toContain("Solución sugerida:");
      expect(known.advice).toContain("auto-corregirse");

      const unknown = suggestFix("mensaje sin patron conocido");
      expect(unknown.error).toBeNull();
      expect(unknown.advice).toContain("Error desconocido");
    });
  });
});
