function useColors(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  if (!process.stderr.isTTY) return false;
  if (process.platform === "win32") {
    const term = process.env.TERM;
    if (term && term !== "dumb") return true;
    if (process.env.WT_SESSION) return true;
    if (process.env.TERM_PROGRAM === "vscode") return true;
    return false;
  }
  return true;
}

const c = useColors();

const A = {
  reset: c ? "\x1b[0m" : "",
  bold: c ? "\x1b[1m" : "",
  dim: c ? "\x1b[2m" : "",
  italic: c ? "\x1b[3m" : "",
  cyan: c ? "\x1b[36m" : "",
  yellow: c ? "\x1b[33m" : "",
  green: c ? "\x1b[32m" : "",
  red: c ? "\x1b[31m" : "",
  gray: c ? "\x1b[90m" : "",
};

const NL = "\n";

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

const SEP = c ? "\u2502" : "|";

function fmt(v: unknown, maxLines = 15): string {
  let text: string;
  try {
    text = JSON.stringify(v, null, 2);
  } catch {
    text = String(v);
  }
  const lines = text.split(NL);
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join(NL) + `${NL}${A.dim}\u22ef (${lines.length - maxLines} líneas más)${A.reset}`;
}

function writeLines(
  write: (line: string) => void,
  prefix: string,
  text: string,
  continuationIndent: string,
): void {
  const lines = text.split(NL);
  write(`${prefix}${lines[0]}`);
  for (let i = 1; i < lines.length; i++) {
    write(`${continuationIndent}${lines[i]}`);
  }
}

export function wrapHandler(
  toolName: string,
  handler: (input: any) => Promise<any>,
  write: (line: string) => void,
): (input: any) => Promise<any> {
  return async (input: any) => {
    const start = Date.now();
    const timestamp = ts();

    const bar = `${A.gray}${SEP}${A.reset}`;

    write(`${A.gray}\u256d\u2500\u2500${A.reset} ${A.bold}${A.cyan}MCP${A.reset} ${A.gray}\u25b8${A.reset} ${A.bold}${toolName}${A.reset}  ${A.gray}${timestamp}${A.reset}`);

    const inputStr = fmt(input).trim();
    if (inputStr && inputStr !== "{}") {
      writeLines(write, `${bar} ${A.yellow}\u25c0${A.reset}  `, inputStr, `${bar}    `);
    } else {
      write(`${bar} ${A.yellow}\u25c0${A.reset}  ${A.dim}${A.italic}\u2014${A.reset}`);
    }

    try {
      const result = await handler(input);
      const dur = Date.now() - start;
      const isErr = result.isError === true;

      const display = result.structuredContent ?? result;
      const displayStr = fmt(display, isErr ? 30 : 10).trim();

      const icon = isErr ? `${A.red}\u25b6${A.reset}` : `${A.green}\u25b6${A.reset}`;
      const label = isErr ? `${A.red}err${A.reset}` : `${A.green}ok${A.reset}`;
      const durFmt = `${A.dim}${dur}ms${A.reset}`;

      const lines = displayStr.split(NL);
      write(`${bar} ${icon}  ${label}  ${lines[0]}  ${durFmt}`);
      for (let i = 1; i < lines.length; i++) {
        write(`${bar}        ${lines[i]}`);
      }

      write(`${A.gray}\u2570\u2500\u2500\u2500 ${durFmt} ${"".padEnd(55, "\u2500")}${A.reset}`);

      return result;
    } catch (error) {
      const dur = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      write(`${bar} ${A.red}\u25b6${A.reset}  ${A.red}error${A.reset} ${errMsg}`);
      write(`${A.gray}\u2570\u2500\u2500\u2500 ${A.dim}${dur}ms${A.reset} ${"".padEnd(55, "\u2500")}${A.reset}`);
      throw error;
    }
  };
}
