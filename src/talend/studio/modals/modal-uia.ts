import { join } from "node:path";
import type { ModalSnapshot } from "./modal-types";

/**
 * Lectura y pulsado de dialogos por accesibilidad de Windows (UI Automation).
 *
 * No pasa por el bridge de Studio: sigue funcionando con el bridge caido o con el hilo de la
 * interfaz atascado en un dialogo, que es justo cuando hace falta.
 */

const PS_DIR = join(import.meta.dir, "ps");
const TIMEOUT_MS = 25_000;

async function runPowerShell(args: string[], timeoutMs = TIMEOUT_MS): Promise<string> {
  const proc = Bun.spawn(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  if (code !== 0) throw new Error(`PowerShell salio con ${code}: ${(err || out).trim().slice(0, 300)}`);
  return out.trim();
}

/** Proceso de Talend Studio, buscado por nombre (no depende del bridge). */
export async function findStudioPid(): Promise<number | undefined> {
  const out = await runPowerShell(["-Command", "(Get-Process | Where-Object { $_.ProcessName -like 'Talend-Studio*' } | Select-Object -First 1).Id"], 15_000);
  const pid = Number(out);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

/** Convierte la salida JSON del script de lectura; un objeto suelto cuenta como una lista de uno. */
export function parseModalSnapshots(json: string): ModalSnapshot[] {
  if (!json) return [];
  const parsed: unknown = JSON.parse(json);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((raw) => {
    const m = raw as Record<string, unknown>;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]);
    return {
      handle: Number(m.handle),
      title: String(m.title ?? ""),
      texts: strings(m.texts),
      buttons: strings(m.buttons),
      editableFields: Number(m.editableFields ?? 0),
      passwordFields: Number(m.passwordFields ?? 0),
    };
  });
}

export async function readModals(pid: number, options: { includeMain?: boolean } = {}): Promise<ModalSnapshot[]> {
  const extra = options.includeMain ? ["-IncludeMain"] : [];
  const out = await runPowerShell(["-File", join(PS_DIR, "modals-read.ps1"), "-ProcessId", String(pid), ...extra]);
  return parseModalSnapshots(out);
}

export interface PressResult {
  ok: boolean;
  pressed: string | null;
  via: string | null;
  error: string | null;
}

export async function pressModalButton(handle: number, button: string): Promise<PressResult> {
  const out = await runPowerShell(["-File", join(PS_DIR, "modals-press.ps1"), "-Handle", String(handle), "-Button", button]);
  return JSON.parse(out) as PressResult;
}
