import type { LatestRunLog, RunLogEntry } from "./types";

function extractTimestamp(line: string): string | undefined {
  return /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.exec(line)?.[0];
}

function includesJob(line: string, jobName: string): boolean {
  return line.toLowerCase().includes(jobName.toLowerCase());
}

export function parseLatestRunLog(logText: string, jobName: string): LatestRunLog {
  const lines = logText.split(/\r?\n/);
  const errors: RunLogEntry[] = [];
  let latestCommand: RunLogEntry | undefined;
  let latestError: RunLogEntry | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;

    if (includesJob(line, jobName) && line.includes("Command line:")) {
      latestCommand = { timestamp: extractTimestamp(line), line: lineNumber, message: line };
    }

    const isJobError =
      includesJob(line, jobName) &&
      /(ERROR|Exception|wrong configuration|Unknown column|Data too long|cannot be resolved)/i.test(line);
    if (isJobError) {
      const detail = lines.slice(index, Math.min(lines.length, index + 4)).join("\n");
      latestError = { timestamp: extractTimestamp(line), line: lineNumber, message: detail };
      errors.push(latestError);
    }
  }

  const status =
    latestError && (!latestCommand || latestError.line > latestCommand.line) ? "error" : "unknown";

  return { jobName, status, latestCommand, latestError, errors };
}