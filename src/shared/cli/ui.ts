/**
 * Salida de consola para los CLI del proyecto.
 *
 * Un solo formato para todos los scripts: icono por nivel, color solo cuando la
 * salida es interactiva y `NO_COLOR` no lo desactiva, y el mismo texto cuando se
 * redirige a un archivo o a un cliente MCP (sin secuencias ANSI).
 *
 * Niveles:
 *   quiet   → solo avisos y errores
 *   normal  → lo anterior mas pasos, resultados e informacion
 *   verbose → ademas trazas de depuracion y tiempos
 *
 * Se controla con `TALEND_MCP_LOG` (`quiet|normal|verbose`); `NO_COLOR=1`
 * desactiva el color y `FORCE_COLOR=1` lo fuerza.
 */

export type UiLevel = "quiet" | "normal" | "verbose";

export type UiStream = { write(chunk: string): unknown };

export type UiTone = "neutral" | "success" | "warning" | "error";

export type UiOptions = {
  level?: UiLevel;
  color?: boolean;
  stream?: UiStream;
  now?: () => number;
};

export type Ui = {
  ok(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  fail(message: string): void;
  step(message: string): void;
  debug(message: string): void;
  line(message?: string): void;
  separator(width?: number): void;
  banner(title: string, lines?: string[], tone?: UiTone): void;
  /** Ejecuta una tarea y reporta `✓ etiqueta (1,2 s)` o `✖ etiqueta (1,2 s)`. */
  timed<T>(label: string, task: () => Promise<T> | T): Promise<T>;
  isVerbose(): boolean;
  isQuiet(): boolean;
};

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
} as const;

const ICONS = {
  ok: "✓",
  info: "•",
  warn: "⚠",
  fail: "✖",
  step: "→",
  debug: "·",
} as const;

const STYLES = {
  reset: COLORS.reset,
  bold: COLORS.bold,
  dim: COLORS.dim,
  red: COLORS.red,
  green: COLORS.green,
  yellow: COLORS.yellow,
  cyan: COLORS.cyan,
  magenta: COLORS.magenta,
} as const;

export type TextStyle = keyof typeof STYLES;

/**
 * Coloreador para resaltar fragmentos dentro de una linea (rutas, versiones).
 * Respeta la misma decision de color que `createUi`.
 */
export function createStyler(color: boolean): (text: unknown, style: TextStyle) => string {
  if (!color) return (text) => String(text);
  return (text, style) => `${STYLES[style]}${String(text)}${COLORS.reset}`;
}

export const UI_MAX_LINE = 88;

export function parseUiLevel(value: string | undefined): UiLevel {
  const normalized = value?.trim().toLowerCase();
  return normalized === "quiet" || normalized === "verbose" ? normalized : "normal";
}

/** El color se decide una vez: TTY, `NO_COLOR` y `FORCE_COLOR`. */
export function shouldUseColor(env: Record<string, string | undefined>, isTTY: boolean): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR === "1") return true;
  return isTTY;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0).replace(".", ",")} s`;
}

/** Ajusta un texto a una linea sin cortar palabras cuando se puede. */
export function truncateLine(text: string, max = UI_MAX_LINE): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max - 1).trimEnd()}…`;
}

function defaultValue(): UiLevel {
  return parseUiLevel(process.env.TALEND_MCP_LOG);
}

export function createUi(options: UiOptions = {}): Ui {
  const level = options.level ?? defaultValue();
  const stream = options.stream ?? process.stderr;
  const now = options.now ?? (() => Date.now());
  const color = options.color ?? shouldUseColor(process.env, Boolean(process.stderr.isTTY));
  // Un ancho menor al de la consola evita que las reglas se partan en dos
  // lineas cuando la terminal es angosta (por ejemplo, la de VS Code).
  const columns = (process.stderr as { columns?: number }).columns ?? 80;
  const ruleWidth = Math.max(24, Math.min(52, columns - 4));

  const paint = (text: string, tone: UiTone): string => {
    if (!color) return text;
    const code = tone === "success" ? COLORS.green
      : tone === "warning" ? COLORS.yellow
      : tone === "error" ? COLORS.red
      : COLORS.cyan;
    return `${code}${text}${COLORS.reset}`;
  };

  const write = (text: string): void => {
    stream.write(`${text}\n`);
  };

  const emit = (icon: string, message: string, tone: UiTone): void => {
    write(`${paint(icon, tone)} ${message}`);
  };

  const ui: Ui = {
    ok: (message) => { if (level !== "quiet") emit(ICONS.ok, message, "success"); },
    info: (message) => { if (level !== "quiet") emit(ICONS.info, message, "neutral"); },
    warn: (message) => emit(ICONS.warn, message, "warning"),
    fail: (message) => emit(ICONS.fail, message, "error"),
    step: (message) => { if (level !== "quiet") emit(ICONS.step, message, "neutral"); },
    debug: (message) => { if (level === "verbose") emit(ICONS.debug, message, "neutral"); },
    line: (message = "") => { if (level !== "quiet") write(message); },
    separator: (width = ruleWidth) => {
      if (level === "quiet") return;
      const rule = "─".repeat(width);
      write(color ? `  ${COLORS.dim}${rule}${COLORS.reset}` : `  ${rule}`);
    },
    banner: (title, lines = [], tone = "neutral") => {
      if (level === "quiet") return;
      const border = color ? `${COLORS.dim}${"─".repeat(ruleWidth)}${COLORS.reset}` : "─".repeat(ruleWidth);
      write("");
      write(`  ${border}`);
      write(`  ${paint(title, tone)}`);
      write(`  ${border}`);
      for (const item of lines) write(`  ${item}`);
      write(`  ${border}`);
      write("");
    },
    async timed(label, task) {
      const started = now();
      try {
        const value = await task();
        if (level !== "quiet") emit(ICONS.ok, `${label} (${formatDuration(now() - started)})`, "success");
        return value;
      } catch (error) {
        emit(ICONS.fail, `${label} (${formatDuration(now() - started)})`, "error");
        throw error;
      }
    },
    isVerbose: () => level === "verbose",
    isQuiet: () => level === "quiet",
  };

  return ui;
}

/** Instancia compartida por los scripts. */
export const ui = createUi();
