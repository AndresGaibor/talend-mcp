import type { TalendStudioBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";

type Opciones = {
  /** Consultas como maximo antes de rendirse. */
  intentos?: number;
  /** Espera entre consultas; se puede sustituir para no esperar de verdad. */
  pausa?: () => Promise<void>;
};

const PAUSA_MS = 3000;

/**
 * Espera a que el hilo de interfaz de Studio responda.
 *
 * Crear un Job deja a Studio trabajando en segundo plano (generar su proyecto Maven, recalcular marcadores).
 * Si se encadenan decenas de Jobs sin esperar, ese trabajo se acumula y una operacion de interfaz agota
 * su tiempo ("El hilo de la interfaz de Studio esta ocupado"). Consultar el estado del workbench pasa por
 * ese mismo hilo, asi que solo responde cuando esta libre.
 *
 * @returns true si la interfaz respondio; false si se agotaron los intentos (la operacion sigue de todos modos).
 */
export async function esperarInterfazLibre(
  bridge: Pick<TalendStudioBridgeClient, "workbenchState">,
  { intentos = 40, pausa = () => new Promise<void>((resolve) => setTimeout(resolve, PAUSA_MS)) }: Opciones = {},
): Promise<boolean> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const estado = await bridge.workbenchState();
      if (estado.ok) return true;
    } catch (error) {
      // Solo una interfaz ocupada se espera; cualquier otro fallo no mejora esperando.
      const mensaje = error instanceof Error ? error.message : String(error);
      if (!/ocupad|tiempo|timed? ?out/i.test(mensaje)) return false;
    }
    if (intento < intentos) await pausa();
  }
  return false;
}
