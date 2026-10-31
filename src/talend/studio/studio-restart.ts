import { join } from "node:path";
import { createBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";

/**
 * Reinicio de Talend Studio a peticion.
 *
 * Studio retiene en memoria cada editor de job que abre (~13 MB por caso, que ni la recoleccion ni el cierre
 * del editor liberan) y una sesion larga de creacion de Jobs acaba con el IDE sin responder. No se ha encontrado
 * forma de soltarlo sin reiniciar. El reinicio tiene el control del IDE:
 *
 * 1. Cierra los dialogos abiertos del proceso (un modal impide que Studio salga) y pide el cierre de la ventana
 *    principal (`CloseMainWindow`), repitiendo ambos pasos mientras Studio siga vivo.
 * 2. Si no sale en `CLOSE_WAIT_MS` y `force` no es false, termina el proceso.
 * 3. Lo vuelve a abrir con el mismo ejecutable y espera a que el bridge responda.
 * 4. Opcionalmente reinstala el plugin del bridge (un Studio recien arrancado carga el plugin instalado, no las
 *    publicaciones en caliente anteriores).
 *
 * Solo Windows: el ejecutable y el cierre ordenado se resuelven con PowerShell.
 */

export const CLOSE_WAIT_MS = 120_000;
export const START_WAIT_MS = 300_000;

/** Memoria a partir de la cual conviene reiniciar Studio. */
export const RESTART_RECOMMENDED_PERCENT = 75;

const ROOT = join(import.meta.dir, "..", "..", "..");

/** Tope por defecto de un comando de PowerShell suelto. */
const POWERSHELL_TIMEOUT_MS = 60_000;

async function powershell(command: string, timeoutMs = POWERSHELL_TIMEOUT_MS): Promise<{ output: string; code: number }> {
  const process = Bun.spawn(["powershell", "-NoProfile", "-NonInteractive", "-Command", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const [output, code] = await Promise.all([new Response(process.stdout).text(), Promise.race([process.exited, timeout])]);
  if (timer) clearTimeout(timer);

  if (code === "timeout") {
    // Sin esto, un PowerShell atascado deja la tool esperando para siempre.
    process.kill();
    await process.exited;
    throw new Error(`PowerShell no respondio en ${timeoutMs} ms.`);
  }
  return { output: output.trim(), code };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** El pid de Studio segun el bridge, o undefined si no responde. */
export async function studioPid(attempts = 3): Promise<number | undefined> {
  // Studio ocupado (compilando, con un dialogo) tarda en contestar: no se da por caido a la primera.
  for (let attempt = 0; attempt < attempts; attempt++) {
    const bridge = await createBridgeClient({ config: { timeoutMs: 15_000 } });
    const heartbeat = await bridge.ping().catch(() => undefined);
    const pid = (heartbeat?.data as { pid?: number } | undefined)?.pid;
    if (heartbeat?.ok && pid !== undefined) return pid;
  }
  return undefined;
}

/** Studio colgado no contesta al bridge: se le busca por el nombre del proceso. */
async function studioPidByName(): Promise<number | undefined> {
  const found = await powershell("(Get-Process | Where-Object { $_.ProcessName -like 'Talend-Studio*' } | Select-Object -First 1).Id");
  const pid = Number(found.output);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

/**
 * Cierra Studio: dialogos del proceso (WM_CLOSE, como pulsar la X), cierre de la ventana principal y, si sigue vivo
 * pasado el plazo, `Stop-Process -Force`. Salida: `closed=<dialogos cerrados>` y `forced=<0|1>`.
 */
const closeScript = (pid: number, waitMs: number, force: boolean) => `
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class StudioDialogs {
  delegate bool Callback(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback c, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static int CloseOthers(uint pid, IntPtr main) {
    int closed = 0;
    EnumWindows((h, l) => {
      uint owner; GetWindowThreadProcessId(h, out owner);
      if (owner == pid && h != main && IsWindowVisible(h)) { PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero); closed++; }
      return true;
    }, IntPtr.Zero);
    return closed;
  }
}
'@
$p = Get-Process -Id ${pid}
$closed = 0
$deadline = (Get-Date).AddMilliseconds(${waitMs})
while (-not $p.HasExited -and (Get-Date) -lt $deadline) {
  $closed += [StudioDialogs]::CloseOthers(${pid}, $p.MainWindowHandle)
  [void]$p.CloseMainWindow()
  [void]$p.WaitForExit(3000)
  $p.Refresh()
}
$forced = 0
if (-not $p.HasExited -and ${force ? "$true" : "$false"}) { Stop-Process -Id ${pid} -Force; [void]$p.WaitForExit(30000); $forced = 1 }
"closed=$closed"
"forced=$forced"
if ($p.HasExited) { exit 0 } else { exit 2 }
`;

export type RestartDecision = { proceed: true } | { proceed: false; code: string; message: string };

/**
 * Si se puede y conviene reiniciar. Funcion pura: la herramienta le pasa lo que midio.
 * Un reinicio es mas drastico que cualquier otra herramienta del MCP (cierra el IDE del usuario), asi que se
 * rechaza con el bridge en solo lectura. Los dialogos abiertos no lo impiden: el reinicio los cierra.
 */
export function decideRestart(input: {
  platform: string;
  readOnly: boolean;
  usedPercent?: number;
  onlyIfMemoryAbove?: number;
}): RestartDecision {
  if (input.platform !== "win32") {
    return { proceed: false, code: "STUDIO_RESTART_UNSUPPORTED", message: "El reinicio de Studio solo esta implementado en Windows." };
  }
  if (input.readOnly) {
    return {
      proceed: false,
      code: "STUDIO_RESTART_READONLY",
      message: "El bridge esta en solo lectura: reiniciar Studio cierra el IDE, asi que requiere permiso de escritura.",
    };
  }
  if (
    input.onlyIfMemoryAbove !== undefined &&
    input.usedPercent !== undefined &&
    input.usedPercent <= input.onlyIfMemoryAbove
  ) {
    return {
      proceed: false,
      code: "STUDIO_RESTART_NOT_NEEDED",
      message: `Studio usa el ${input.usedPercent}% de su memoria (umbral ${input.onlyIfMemoryAbove}%): no hace falta reiniciarlo.`,
    };
  }
  return { proceed: true };
}

export type RestartResult = {
  previousPid: number;
  pid: number;
  seconds: number;
  closedDialogs: number;
  /** True si Studio no salio por las buenas y hubo que terminar el proceso. */
  forced: boolean;
  reinstalledBridge: boolean;
};

export async function restartStudio(options: { reinstallBridge?: boolean; force?: boolean } = {}): Promise<RestartResult> {
  const started = Date.now();
  const previousPid = (await studioPid(1)) ?? (await studioPidByName());
  if (previousPid === undefined) throw new Error("Studio no esta en ejecucion: no hay nada que reiniciar");

  const executable = (
    await powershell(`(Get-CimInstance Win32_Process -Filter "ProcessId=${previousPid}").ExecutablePath`)
  ).output;
  if (!executable) throw new Error(`No se pudo leer el ejecutable de Studio (pid ${previousPid})`);

  // El script de cierre espera dentro hasta CLOSE_WAIT_MS: el tope es mayor.
  const closing = await powershell(closeScript(previousPid, CLOSE_WAIT_MS, options.force !== false), CLOSE_WAIT_MS + 60_000);
  if (closing.code !== 0) {
    throw new Error("Studio no se cerro a tiempo y no se forzo el cierre (force: false).");
  }
  const closedDialogs = Number(/closed=(\d+)/.exec(closing.output)?.[1] ?? 0);
  const forced = /forced=1/.test(closing.output);

  const folder = executable.replace(/[\\/][^\\/]+$/, "");
  await powershell(`Start-Process -FilePath '${executable}' -WorkingDirectory '${folder}'`);

  const deadline = Date.now() + START_WAIT_MS;
  let pid = await studioPid();
  while (pid === undefined) {
    if (Date.now() > deadline) throw new Error("Studio no arranco a tiempo");
    await sleep(5_000);
    pid = await studioPid();
  }

  if (options.reinstallBridge) {
    const install = Bun.spawn(["bun", "run", "bridge:install"], { cwd: ROOT, stdout: "ignore", stderr: "ignore" });
    // Maven/Tycho puede tardar minutos, pero no puede quedarse indefinidamente.
    const installTimer = setTimeout(() => install.kill(), 600_000);
    const installCode = await install.exited;
    clearTimeout(installTimer);
    if (installCode !== 0) throw new Error("No se pudo reinstalar el plugin del bridge");
    await sleep(5_000);
  }

  return { previousPid, pid, seconds: Math.round((Date.now() - started) / 1000), closedDialogs, forced, reinstalledBridge: options.reinstallBridge === true };
}
