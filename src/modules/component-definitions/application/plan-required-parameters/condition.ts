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
