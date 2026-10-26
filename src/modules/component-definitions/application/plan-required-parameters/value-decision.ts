import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import type { DefinitionParameter } from "../../domain/component-definition.types";
import { evaluateCondition } from "./condition";

/** Una ruta de pruebas que no depende de la máquina. */
function testDirectory(): string {
  let base = tmpdir();
  try {
    // En Windows `tmpdir()` puede devolver el nombre corto (USUARI~1).
    base = realpathSync.native(base);
  } catch {
    // Se usa el valor tal cual.
  }
  return join(base, "mcp_coverage").replace(/\\/g, "/");
}

/**
 * Un valor por defecto sirve si no es una macro de Talend
 * (`__COMP_DEFAULT_FILE_DIR__`) ni una referencia a un contexto (`${...}`).
 */
function usableDefault(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.includes("__COMP_DEFAULT_")) return undefined;
  if (trimmed.includes("${")) return undefined;
  return trimmed;
}

/** ¿Es un literal Java ya entrecomillado? */
function isQuoted(value: string): boolean {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"');
}

/** ¿El parámetro se ve con los valores que se conocen? */
export function isVisible(parameter: DefinitionParameter, values: Record<string, string | undefined>): boolean {
  if (parameter.showIf) {
    const result = evaluateCondition(parameter.showIf, values);
    if (result === false) return false;
  }
  if (parameter.notShowIf) {
    const result = evaluateCondition(parameter.notShowIf, values);
    if (result === true) return false;
  }
  return true;
}

/** Campos cuyo valor no se puede inventar (código, tablas, conexiones). */
export function needsRealValue(field: string): boolean {
  const upper = field.toUpperCase();
  return (
    upper.includes("CODE") ||
    upper.includes("MEMO") ||
    upper.includes("SCHEMA") ||
    upper.includes("TABLE") ||
    upper.includes("CONNECTION") ||
    upper.includes("DB") ||
    upper.includes("PASSWORD") ||
    upper.includes("XML") ||
    upper.includes("JSON") ||
    upper.includes("REGEX") ||
    upper.includes("PATTERN") ||
    upper.includes("PROPERTY")
  );
}

/**
 * Decide el valor de un parámetro obligatorio.
 *
 * Devuelve el valor ya en forma de literal de Java, o `null` si no hay uno
 * razonable.
 */
export function decideValue(
  parameter: DefinitionParameter,
  component: string,
): { value: string; literal: boolean; source: "default" | "generated" } | null {
  const field = parameter.field.toUpperCase();
  const defaultValue = usableDefault(parameter.defaultValue);

  if (field.includes("CHECK")) {
    if (!defaultValue) return null;
    return { value: defaultValue, literal: false, source: "default" };
  }

  if (field.includes("FILE")) {
    if (defaultValue) {
      return { value: defaultValue, literal: false, source: "default" };
    }
    return {
      value: `${testDirectory()}/${component.toLowerCase()}.dat`,
      literal: true,
      source: "generated",
    };
  }

  if (field.includes("DIRECTORY") || field.includes("FOLDER")) {
    if (defaultValue) {
      return { value: defaultValue, literal: false, source: "default" };
    }
    return { value: testDirectory(), literal: true, source: "generated" };
  }

  if (field.includes("LIST") || parameter.possibleValues) {
    if (defaultValue) {
      return { value: defaultValue, literal: false, source: "default" };
    }
    const first = parameter.possibleValues?.[0];
    if (first === undefined) return null;
    return { value: first, literal: false, source: "generated" };
  }

  if (field.includes("TEXT") || field.includes("STRING") || field.includes("CHAR")) {
    if (defaultValue) {
      return {
        value: defaultValue,
        literal: !isQuoted(defaultValue),
        source: "default",
      };
    }
    return { value: "prueba", literal: true, source: "generated" };
  }

  if (defaultValue) {
    return { value: defaultValue, literal: false, source: "default" };
  }

  return null;
}
