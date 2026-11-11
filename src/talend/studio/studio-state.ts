/**
 * Estado de Talend Studio como funcion pura de una sonda.
 *
 * La sonda (`probeStudio`) mide; esta funcion solo decide. Asi cada caso real
 * (bridge mudo, login pendiente, dialogo modal) queda fijado por una prueba y
 * no por una espera de 180 s.
 */

export type StudioState =
  | "READY"
  | "NOT_RUNNING"
  | "WAITING_LOGIN"
  | "BRIDGE_DEAD"
  | "MODAL_BLOCKING"
  | "BUSY";

export interface StudioProbe {
  /** Proceso de Studio, si existe. */
  pid?: number | undefined;
  /** `GET /ping` del bridge respondio. */
  pingOk: boolean;
  pingMs?: number | undefined;
  /** Titulos de los dialogos abiertos; vacio si no hay. */
  modalTitles: string[];
  /** La ventana principal es la pantalla de login ("Talend Cloud Data Fabric"). */
  loginScreen: boolean;
  /** Hay una compilacion o ejecucion en curso. */
  runningJob: boolean;
}

export interface StudioStateResult {
  state: StudioState;
  reason: string;
}

/** Precedencia: sin proceso, login, bridge mudo, dialogo, ocupado, listo. */
export function classifyStudioState(probe: StudioProbe): StudioStateResult {
  if (probe.pid === undefined) {
    return { state: "NOT_RUNNING", reason: "No hay proceso de Talend Studio." };
  }
  if (!probe.pingOk) {
    if (probe.loginScreen) {
      return {
        state: "WAITING_LOGIN",
        reason: "Studio esta abierto en la pantalla de login: el bridge arranca despues de iniciar sesion.",
      };
    }
    return {
      state: "BRIDGE_DEAD",
      reason: `Studio (pid ${probe.pid}) esta abierto pero el bridge no responde a /ping.`,
    };
  }
  if (probe.modalTitles.length > 0) {
    return {
      state: "MODAL_BLOCKING",
      reason: `Dialogo abierto en Studio: ${probe.modalTitles.map((t) => `"${t}"`).join(", ")}.`,
    };
  }
  if (probe.runningJob) {
    return { state: "BUSY", reason: "Studio esta compilando o ejecutando un Job." };
  }
  return { state: "READY", reason: "Studio responde y no tiene dialogos abiertos." };
}
