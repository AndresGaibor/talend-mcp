import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export interface RunHistoryEntry {
  runId: string;
  jobName: string;
  scriptPath: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error" | "timeout" | "killed";
  exitCode?: number | null;
  durationMs?: number;
  stdoutPath: string;
  stderrPath: string;
  metadataPath: string;
}

export interface RunIndex {
  runs: RunHistoryEntry[];
}

function getRunsDir(): string {
  return join(process.cwd(), ".talend-mcp", "runs");
}

function getIndexPath(): string {
  return join(getRunsDir(), "index.json");
}

async function readIndex(): Promise<RunIndex> {
  const indexPath = getIndexPath();
  try {
    const content = await Bun.file(indexPath).text();
    return JSON.parse(content) as RunIndex;
  } catch {
    return { runs: [] };
  }
}

async function writeIndex(index: RunIndex): Promise<void> {
  const indexPath = getIndexPath();
  mkdirSync(getRunsDir(), { recursive: true });
  await Bun.write(indexPath, JSON.stringify(index, null, 2));
}

export async function saveRun(entry: Omit<RunHistoryEntry, "metadataPath">): Promise<void> {
  const index = await readIndex();
  const metadataPath = join(getRunsDir(), `${entry.runId}.meta.json`);
  const fullEntry: RunHistoryEntry = { ...entry, metadataPath };

  const existingIndex = index.runs.findIndex((r) => r.runId === entry.runId);
  if (existingIndex >= 0) {
    index.runs[existingIndex] = fullEntry;
  } else {
    index.runs.push(fullEntry);
  }

  await writeIndex(index);

  const meta = {
    runId: entry.runId,
    jobName: entry.jobName,
    scriptPath: entry.scriptPath,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    status: entry.status,
    exitCode: entry.exitCode,
    durationMs: entry.durationMs,
  };
  await Bun.write(metadataPath, JSON.stringify(meta, null, 2));
}

export async function listRuns(options?: {
  jobName?: string;
  limit?: number;
}): Promise<RunHistoryEntry[]> {
  const index = await readIndex();
  let runs = index.runs;

  if (options?.jobName) {
    runs = runs.filter((r) => r.jobName === options.jobName);
  }

  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (options?.limit && options.limit > 0) {
    runs = runs.slice(0, options.limit);
  }

  return runs;
}

export async function readRun(runId: string): Promise<RunHistoryEntry | null> {
  const index = await readIndex();
  return index.runs.find((r) => r.runId === runId) ?? null;
}

export async function tailRunOutput(options: {
  runId: string;
  stream: "stdout" | "stderr" | "both";
  maxLines?: number;
}): Promise<{ stdout?: string; stderr?: string; error?: string }> {
  const entry = await readRun(options.runId);
  if (!entry) {
    return { error: `Run no encontrado: ${options.runId}` };
  }

  const result: { stdout?: string; stderr?: string } = {};
  const maxLines = options.maxLines ?? 50;

  if (options.stream === "stdout" || options.stream === "both") {
    try {
      const content = await Bun.file(entry.stdoutPath).text();
      const lines = content.split("\n");
      result.stdout = lines.slice(-maxLines).join("\n");
    } catch (err) {
      result.stdout = `Error leyendo stdout: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (options.stream === "stderr" || options.stream === "both") {
    try {
      const content = await Bun.file(entry.stderrPath).text();
      const lines = content.split("\n");
      result.stderr = lines.slice(-maxLines).join("\n");
    } catch (err) {
      result.stderr = `Error leyendo stderr: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return result;
}
