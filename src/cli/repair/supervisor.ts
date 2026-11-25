import { spawnSync } from "node:child_process";
import { platform } from "node:os";

/** Tarea de Windows que arrancaba el supervisor al iniciar sesion. */
export const SUPERVISOR_TASK = "TalendMcpSupervisor";

export function supervisorTaskInstalled(): boolean {
  if (platform() !== "win32") return false;
  const result = spawnSync("schtasks.exe", ["/Query", "/TN", SUPERVISOR_TASK], {
    windowsHide: true,
    encoding: "utf8",
  });
  return result.status === 0;
}

export function removeSupervisorTask(): boolean {
  const result = spawnSync("schtasks.exe", ["/Delete", "/TN", SUPERVISOR_TASK, "/F"], {
    windowsHide: true,
    encoding: "utf8",
  });
  return result.status === 0;
}

/** Mata un supervisor que siguiera en marcha (la tarea o un `bun run supervisor` manual). */
export function stopSupervisorProcesses(): number {
  if (platform() === "win32") {
    const script = [
      "$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'supervisor\\.ts' }",
      "$p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      "@($p).Count",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      encoding: "utf8",
    });
    return Number((result.stdout ?? "").trim()) || 0;
  }

  const found = spawnSync("pgrep", ["-f", "scripts/supervisor.ts"], { encoding: "utf8" });
  if (found.status !== 0) return 0;
  const pids = (found.stdout ?? "").split(/\s+/).filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {}
  }
  return pids.length;
}
