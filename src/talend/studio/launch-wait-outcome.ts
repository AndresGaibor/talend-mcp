/**
 * Interpreta la respuesta de `/launch/wait` del bridge.
 *
 * El bridge responde `ok: true` tambien cuando el launch sigue en marcha al
 * acabar el timeout (`timedOut: true`). Quien consume la respuesta debe mirar
 * `terminated`: `ok` solo dice que la espera se pudo hacer.
 */

export type LaunchWaitOutcome = {
  launchId: string;
  terminated: boolean;
  timedOut: boolean;
  status: string;
  exitCode: number | null;
  durationMs: number | null;
};

export function interpretLaunchWait(launchId: string, data: Record<string, unknown> | undefined): LaunchWaitOutcome {
  const timedOut = data?.timedOut === true;
  const terminated = !timedOut && data?.terminated === true;
  const status = typeof data?.status === "string" ? data.status : terminated ? "terminated" : "started";

  return {
    launchId,
    terminated,
    timedOut,
    status,
    exitCode: typeof data?.exitCode === "number" ? data.exitCode : null,
    durationMs: typeof data?.durationMs === "number" ? data.durationMs : null,
  };
}
