import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import type {
  ComponentDefinition,
  DefinitionParameter,
  DefinitionTable,
} from "../domain/component-definition.types";

/**
 * Plan de relleno de los parámetros obligatorios de un componente.
 *
 * Un componente se configura con sus parámetros obligatorios: sin ellos el
 * código generado no compila (un `tFileOutputDelimited` sin `FILENAME` da
 * "The constructor File() is undefined"). El plan dice qué valor poner en
 * cada uno, de dónde sale ese valor y a cuál no se le puede dar uno.
 */

export type PlannedParameter =
  | {
      name: string;
      field: string;
      kind: "value";
      value: string;
      /** El valor va entre comillas (es un literal de Java). */
      literal: boolean;
      /** De dónde sale el valor. */
      source: "default" | "generated";
    }
  | {
      name: string;
      field: string;
      kind: "table";
      /** La estructura de la tabla: sus columnas y sus valores por defecto. */
      table: DefinitionTable;
    };

export type SkippedParameter = {
  name: string;
  field: string;
  reason: string;
};

export type RequiredParametersPlan = {
  component: string;
  parameters: PlannedParameter[];
  skipped: SkippedParameter[];
};

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

/**
 * Evalúa una condición de visibilidad de Talend (`SHOW_IF`, `NOT_SHOW_IF`).
 *
 * La sintaxis es la de las expresiones de Talend: comparaciones de un
 * parámetro con un valor entrecomillado, unidas con `and` y `or`, agrupadas
 * con paréntesis.
 *
 * Devuelve `null` cuando la condición no se puede decidir (un parámetro que
 * no se conoce), para que quien llama lo trate como "no se sabe".
 */
export function evaluateCondition(
  condition: string,
  values: Record<string, string | undefined>,
): boolean | null {
  const tokens = tokenize(condition);
  if (!tokens || tokens.length === 0) return null;
  const parser = new ConditionParser(tokens, values);
  try {
    return parser.parseExpression();
  } catch {
    return null;
  }
}

type Token = { kind: "ident" | "value" | "op" | "and" | "or" | "lparen" | "rparen"; text: string };

function tokenize(condition: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  const text = condition.trim();
  while (index < text.length) {
    const char = text[index] ?? "";
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen", text: char });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen", text: char });
      index++;
      continue;
    }
    if (char === "=" && text[index + 1] === "=") {
      tokens.push({ kind: "op", text: "==" });
      index += 2;
      continue;
    }
    if (char === "!" && text[index + 1] === "=") {
      tokens.push({ kind: "op", text: "!=" });
      index += 2;
      continue;
    }
    if (char === "'" || char === '"') {
      const end = text.indexOf(char, index + 1);
      if (end < 0) return null;
      tokens.push({ kind: "value", text: text.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    const rest = text.slice(index);
    const andMatch = /^and\b/i.exec(rest);
    if (andMatch) {
      tokens.push({ kind: "and", text: "and" });
      index += andMatch[0].length;
      continue;
    }
    const orMatch = /^or\b/i.exec(rest);
    if (orMatch) {
      tokens.push({ kind: "or", text: "or" });
      index += orMatch[0].length;
      continue;
    }
    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (identMatch) {
      tokens.push({ kind: "ident", text: identMatch[0] });
      index += identMatch[0].length;
      continue;
    }
    const bareMatch = /^[^\s()]+/.exec(rest);
    if (bareMatch) {
      tokens.push({ kind: "value", text: bareMatch[0] });
      index += bareMatch[0].length;
      continue;
    }
    return null;
  }
  return tokens;
}

class ConditionParser {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly values: Record<string, string | undefined>,
  ) {}

  parseExpression(): boolean | null {
    let result = this.parseTerm();
    if (result === null) return null;
    while (this.peek()?.kind === "and" || this.peek()?.kind === "or") {
      const operator = this.next()!.kind;
      const right = this.parseTerm();
      if (right === null) return null;
      result = operator === "and" ? result && right : result || right;
    }
    return result;
  }

  private parseTerm(): boolean | null {
    const token = this.peek();
    if (!token) return null;
    if (token.kind === "lparen") {
      this.next();
      const inner = this.parseExpression();
      if (this.peek()?.kind !== "rparen") return null;
      this.next();
      return inner;
    }
    if (token.kind !== "ident") return null;
    this.next();
    const operator = this.peek();
    if (!operator || operator.kind !== "op") return null;
    this.next();
    const right = this.peek();
    if (!right || (right.kind !== "value" && right.kind !== "ident")) return null;
    this.next();

    const left = this.values[token.text];
    if (left === undefined) return null;
    const rightValue = right.kind === "ident" ? (this.values[right.text] ?? "") : right.text;
    const same = String(left).trim() === String(rightValue).trim();
    return operator.text === "==" ? same : !same;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token | undefined {
    const token = this.tokens[this.position];
    this.position++;
    return token;
  }
}

/** ¿El parámetro se ve con los valores que se conocen? */
function isVisible(parameter: DefinitionParameter, values: Record<string, string | undefined>): boolean {
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
function needsRealValue(field: string): boolean {
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
function decideValue(
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

/**
 * Calcula el plan de parámetros obligatorios de un componente.
 */
export function planRequiredParameters(definition: ComponentDefinition): RequiredParametersPlan {  const parameters: PlannedParameter[] = [];
  const skipped: SkippedParameter[] = [];

  // Los valores conocidos: los que el propio XML declara por defecto. Sirven
  // para decidir qué parámetros están visibles (SHOW_IF).
  const values: Record<string, string | undefined> = {};
  for (const parameter of definition.parameters) {
    if (parameter.defaultValue !== undefined) values[parameter.name] = parameter.defaultValue;
  }

  for (const parameter of definition.requiredParameters) {
    if (!parameter.show) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "el parametro esta oculto en el formulario (SHOW=false)",
      });
      continue;
    }
    if (!isVisible(parameter, values)) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "no se ve con los valores actuales (SHOW_IF/NOT_SHOW_IF)",
      });
      continue;
    }
    if (needsRealValue(parameter.field)) {
      // Una tabla si se puede: el XML declara sus columnas y sus valores por
      // defecto, y las filas se hacen con las columnas del schema.
      if (parameter.field.toUpperCase().includes("TABLE") && parameter.table) {
        parameters.push({
          name: parameter.name,
          field: parameter.field,
          kind: "table",
          table: parameter.table,
        });
        continue;
      }
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: `hace falta un valor real de tipo ${parameter.field}`,
      });
      continue;
    }
    const decided = decideValue(parameter, definition.name);
    if (!decided) {
      skipped.push({
        name: parameter.name,
        field: parameter.field,
        reason: "no se puede inventar un valor para este tipo de parametro",
      });
      continue;
    }
    parameters.push({
      name: parameter.name,
      field: parameter.field,
      kind: "value",
      value: decided.value,
      literal: decided.literal,
      source: decided.source,
    });
    values[parameter.name] = decided.value;
  }

  return { component: definition.name, parameters, skipped };
}

/**
 * Plan de montaje de un componente: qué conexiones necesita para que el
 * generador produzca código.
 *
 * - Un componente que **consume** (tiene un conector FLOW de entrada) necesita
 *   un origen: un `tFixedFlowInput` con schema.
 * - El destino (un `tLogRow`) no se decide aqui: lo que hace falta depende de
 *   lo que diga el generador. Los componentes de la generación nueva (JDBC,
 *   Snowflake...) no declaran sus conectores en el modelo de Studio, y el
 *   generador falla con "Missing output connection for component X": en ese
 *   caso, quien mide la cobertura anade el `tLogRow` y compila otra vez.
 */
export type MountPlan = {
  /** Los parámetros obligatorios y el valor con el que se rellenan. */
  parameters: Record<string, { value: string; literal: boolean } | { table: DefinitionTable }>;
  /** Hay que conectarle un origen. */
  source: boolean;
};

export function planMount(definition: ComponentDefinition): MountPlan {
  const flow = definition.connectors.filter((connector) => connector.type === "FLOW");
  const plan = planRequiredParameters(definition);
  const parameters: MountPlan["parameters"] = {};
  for (const parameter of plan.parameters) {
    parameters[parameter.name] =
      parameter.kind === "table"
        ? { table: parameter.table }
        : { value: parameter.value, literal: parameter.literal };
  }
  return {
    parameters,
    source: flow.some((connector) => (connector.maxInput ?? 0) >= 1),
  };
}
