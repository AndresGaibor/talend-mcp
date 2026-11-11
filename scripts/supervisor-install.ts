import { spawnSync } from "node:child_process";
import { join } from "node:path";

/**
 * Registra el supervisor como tarea de Windows al iniciar sesion.
 *
 *   bun run scripts/supervisor-install.ts            -> instala (o reemplaza) la tarea
 *   bun run scripts/supervisor-install.ts --status   -> dice si esta instalada
 *   bun run scripts/supervisor-install.ts --remove   -> la quita
 *
 * Es reversible: `--remove` deja el sistema como estaba. No necesita permisos de administrador
 * porque la tarea es del usuario actual.
 */

const ROOT = join(import.meta.dir, "..");
const TASK = "TalendMcpSupervisor";

function ps(command: string): { code: number; out: string } {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", windowsHide: true });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

const arg = process.argv[2];

if (arg === "--status") {
  const r = ps(`(Get-ScheduledTask -TaskName '${TASK}' -ErrorAction SilentlyContinue).State`);
  console.log(r.out ? `Tarea ${TASK}: ${r.out}` : `Tarea ${TASK}: no instalada`);
} else if (arg === "--remove") {
  const r = ps(`Unregister-ScheduledTask -TaskName '${TASK}' -Confirm:$false -ErrorAction SilentlyContinue; 'ok'`);
  console.log(r.code === 0 ? `Tarea ${TASK} eliminada.` : r.out);
} else {
  const action = `New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -Command "Set-Location ''${ROOT}''; bun run supervisor"'`;
  const settings = "New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)";
  const trigger = "New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME";
  const r = ps(`Register-ScheduledTask -TaskName '${TASK}' -Action (${action}) -Trigger (${trigger}) -Settings (${settings}) -Force | Out-Null; 'ok'`);
  console.log(r.code === 0 ? `Tarea ${TASK} instalada: el supervisor arranca al iniciar sesion.` : `No se pudo instalar: ${r.out}`);
  process.exit(r.code);
}
