import { spawnSync } from "node:child_process";

export interface TalendStudioProcess {
  pid: number;
  name: string;
  commandLine?: string;
  matchedBy: string[];
}

export type Confidence = "high" | "medium" | "low" | "none";

export interface ProcessEvidence {
  ok: boolean;
  source: "process" | "unknown";
  confidence: Confidence;
  processes?: TalendStudioProcess[];
  error?: string;
}

const TALEND_KEYWORDS = ["Talend", "TOS_", "Talend-Studio", "TalendStudio"];

function isTalendProcess(name: string, commandLine?: string): string[] {
  const matched: string[] = [];
  const haystack = `${name} ${commandLine ?? ""}`;
  for (const keyword of TALEND_KEYWORDS) {
    if (haystack.includes(keyword)) matched.push(keyword);
  }
  return matched;
}

/**
 * Si un proceso es Talend Studio.
 *
 * Antes bastaba con que "Talend", "TOS" o "eclipse" apareciera en cualquier parte de la linea de
 * comandos, sin distinguir mayusculas en Windows: el `crashpad_handler.exe` de Google Drive (por
 * "Photos") y hasta el propio servidor MCP (por la ruta `talend-mcp`) se tomaban por Studio. Ahora
 * se mira el nombre del ejecutable y, solo para un JVM, que lo lance el launcher de Equinox de Talend.
 */
export function isStudioProcess(name: string, commandLine?: string): boolean {
  const exe = name.toLowerCase().replace(/\.exe$/, "");
  if (exe.startsWith("talend-studio") || exe.startsWith("talendstudio") || exe.startsWith("tos_")) return true;
  if (exe === "java" || exe === "javaw") {
    const line = commandLine ?? "";
    return /org\.eclipse\.equinox\.launcher/i.test(line) && /talend/i.test(line);
  }
  return false;
}

function parsePsLine(line: string): { pid: number; name: string; commandLine: string } | null {
  const trimmed = line.trim();
  if (!trimmed || /^PID/i.test(trimmed)) return null;
  const match = trimmed.match(/^\s*(\d+)\s+(.+)$/);
  if (!match) return null;
  const pid = parseInt(match[1] ?? "", 10);
  if (isNaN(pid)) return null;
  const rest = match[2] ?? "";
  const parts = rest.split(/\s+/);
  const name = parts[0] ?? "";
  const commandLine = parts.slice(1).join(" ");
  return { pid, name, commandLine };
}

export async function detectTalendStudioProcess(): Promise<ProcessEvidence> {
  try {
    if (process.platform === "win32") {
      return await detectWindows();
    }
    return await detectPosix();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, source: "unknown", confidence: "none", error: message };
  }
}

async function detectPosix(): Promise<ProcessEvidence> {
  const result = spawnSync("ps", ["-axo", "pid=,comm=,args="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // Sin tope, un `ps` atascado congela el bucle de eventos del MCP.
    timeout: 10_000,
  });
  if (result.error) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error ejecutando ps: ${result.error.message}`,
    };
  }
  const output = result.stdout ?? "";
  const lines = output.split("\n");
  const processes: TalendStudioProcess[] = [];
  for (const line of lines) {
    const parsed = parsePsLine(line);
    if (!parsed) continue;
    if (!isStudioProcess(parsed.name, parsed.commandLine)) continue;
    const matchedBy = isTalendProcess(parsed.name, parsed.commandLine);
    processes.push({ ...parsed, matchedBy });
  }
  if (processes.length === 0) {
    const eclipseProcesses = lines
      .map((l) => parsePsLine(l))
      .filter((p): p is NonNullable<typeof p> => p !== null && (p.name.includes("Eclipse") || p.name.includes("eclipse")));
    if (eclipseProcesses.length > 0) {
      return {
        ok: true,
        source: "process",
        confidence: "low",
        processes: eclipseProcesses.map((p) => ({
          pid: p.pid,
          name: p.name,
          commandLine: p.commandLine,
          matchedBy: ["Eclipse"],
        })),
      };
    }
    return {
      ok: false,
      source: "process",
      confidence: "none",
      error: "No se detectó proceso de Talend Studio.",
    };
  }
  const confidence: Confidence = processes.some((p) => p.matchedBy.includes("Talend") || p.matchedBy.includes("TalendStudio"))
    ? "medium"
    : "low";
  return { ok: true, source: "process", confidence, processes };
}

async function detectWindows(): Promise<ProcessEvidence> {
  const psScript = `
Get-CimInstance Win32_Process |
Where-Object { $_.Name -like 'Talend-Studio*' -or $_.Name -like 'TalendStudio*' -or $_.Name -like 'TOS_*' -or $_.Name -in 'java.exe','javaw.exe' } |
Select-Object ProcessId,Name,CommandLine |
ConvertTo-Json
  `;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  });
  if (result.error) {
    return {
      ok: false,
      source: "unknown",
      confidence: "none",
      error: `Error ejecutando PowerShell: ${result.error.message}`,
    };
  }
  const output = result.stdout ?? "";
  if (!output.trim() || output.trim() === "null") {
    return {
      ok: false,
      source: "process",
      confidence: "none",
      error: "No se detectó proceso de Talend Studio.",
    };
  }
  try {
    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const processes: TalendStudioProcess[] = items
      .map((item: Record<string, unknown>) => ({
        pid: Number(item.ProcessId) || 0,
        name: String(item.Name ?? ""),
        commandLine: String(item.CommandLine ?? ""),
      }))
      .filter((item) => isStudioProcess(item.name, item.commandLine))
      .map((item) => ({ ...item, matchedBy: isTalendProcess(item.name, item.commandLine) }));
    if (processes.length === 0) {
      return { ok: false, source: "process", confidence: "none", error: "No se detectó proceso de Talend Studio." };
    }
    const confidence: Confidence = processes.some((p) => p.matchedBy.includes("Talend") || p.matchedBy.includes("TalendStudio"))
      ? "medium"
      : "low";
    return { ok: true, source: "process", confidence, processes };
  } catch {
    return { ok: false, source: "unknown", confidence: "none", error: "Error parseando salida de PowerShell." };
  }
}
