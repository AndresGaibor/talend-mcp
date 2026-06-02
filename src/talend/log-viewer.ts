import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import type { LatestRunLog } from "./types";
import { parseLatestRunLog } from "./run-logs";

export interface LogViewerOptions {
  jobName: string;
  maxLines?: number;
  filter?: string;
}

export interface LogFileInfo {
  path: string;
  size: number;
  modified: Date;
}

function findLogDir(): string | undefined {
  if (process.env.TALEND_LOG_DIR) return process.env.TALEND_LOG_DIR;
  if (process.env.TALEND_WORKSPACE) {
    return join(process.env.TALEND_WORKSPACE, "logs");
  }
  return undefined;
}

function findLogFile(jobName: string): LogFileInfo | undefined {
  const logDir = findLogDir();
  if (!logDir || !existsSync(logDir)) return undefined;

  const candidates: LogFileInfo[] = [];

  for (const entry of readdirSync(logDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (!lower.includes(jobName.toLowerCase()) && !lower.endsWith(".log")) continue;

    const fullPath = join(logDir, entry.name);
    try {
      const stat = statSync(fullPath);
      candidates.push({ path: fullPath, size: stat.size, modified: stat.mtime });
    } catch {
      continue;
    }
  }

  if (candidates.length === 0) {
    for (const entry of readdirSync(logDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".log")) continue;
      const fullPath = join(logDir, entry.name);
      try {
        const stat = statSync(fullPath);
        candidates.push({ path: fullPath, size: stat.size, modified: stat.mtime });
      } catch {
        continue;
      }
    }
  }

  candidates.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return candidates[0];
}

export function findJobLogFile(jobName: string): LogFileInfo | undefined {
  return findLogFile(jobName);
}

export function readLogContent(
  logPath: string,
  options: { maxLines?: number; filter?: string; fromLine?: number } = {},
): { lines: string[]; totalLines: number; truncated: boolean } {
  const content = readFileSync(logPath, "utf-8");
  const allLines = content.split(/\r?\n/);
  let lines = allLines;

  if (options.filter) {
    const filter = options.filter.toLowerCase();
    lines = lines.filter((line) => line.toLowerCase().includes(filter));
  }

  if (options.fromLine !== undefined) {
    lines = lines.slice(options.fromLine - 1);
  }

  if (options.maxLines && lines.length > options.maxLines) {
    return {
      lines: lines.slice(-options.maxLines),
      totalLines: allLines.length,
      truncated: true,
    };
  }

  return {
    lines,
    totalLines: allLines.length,
    truncated: false,
  };
}

export function analyzeJobLogs(jobName: string): {
  logFile: LogFileInfo | null;
  analysis: LatestRunLog | null;
  rawSnippet: string[];
  suggestions: string[];
} {
  const logFile = findJobLogFile(jobName);

  if (!logFile) {
    return {
      logFile: null,
      analysis: null,
      rawSnippet: [],
      suggestions: [
        `No se encontró archivo de log para "${jobName}"`,
        "Verifica que TALEND_LOG_DIR o TALEND_WORKSPACE estén configurados",
        "Los logs pueden estar en: workspace/logs/ o en el directorio del job",
      ],
    };
  }

  try {
    const content = readFileSync(logFile.path, "utf-8");
    const analysis = parseLatestRunLog(content, jobName);

    const errorLines = analysis.errors
      .flatMap((e) => e.message.split("\n"))
      .filter((l) => l.trim());

    const suggestions: string[] = [];
    if (analysis.status === "error") {
      suggestions.push("El job falló. Revisa los errores encontrados.");
      if (analysis.errors.length > 0) {
        const firstError = analysis.errors[0]!;
        suggestions.push(`Primera línea de error: línea ${firstError.line}`);
      }
    } else if (analysis.status === "unknown") {
      suggestions.push("No se detectaron errores explícitos pero el job pudo haber fallado.");
    }

    const snippetStart = Math.max(0, analysis.latestError?.line ?? 0 - 5);
    const rawSnippet = content.split(/\r?\n/).slice(snippetStart, snippetStart + 20);

    return {
      logFile,
      analysis,
      rawSnippet,
      suggestions,
    };
  } catch (err) {
    return {
      logFile,
      analysis: null,
      rawSnippet: [],
      suggestions: [`Error al leer log: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export function formatLogLines(lines: string[], showLineNumbers = true): string {
  return lines
    .map((line, i) => {
      const lineNum = showLineNumbers ? `${String(i + 1).padStart(4, " ")}  ` : "";
      const indicator = line.includes("ERROR") || line.includes("Exception")
        ? ">>> "
        : "    ";
      return `${indicator}${lineNum}${line}`;
    })
    .join("\n");
}