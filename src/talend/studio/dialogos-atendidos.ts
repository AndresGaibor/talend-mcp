import type { TalendStudioBridgeClient } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";

/**
 * Ejecuta una operacion de Studio atendiendo los dialogos conocidos que abra mientras corre.
 *
 * Algunas operaciones (conectar dos nodos) abren un modal que deja el hilo de interfaz esperando
 * una respuesta, y la operacion no termina hasta que alguien la da. Mientras dura, se pide al
 * bridge cada poco que conteste los dialogos que conoce; los desconocidos los deja intactos.
 */
export async function conDialogosAtendidos<T>(
  bridge: Pick<TalendStudioBridgeClient, "dismissDialogs">,
  operacion: () => Promise<T>,
  cadaMs = 1000,
): Promise<T> {
  let activo = true;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const programar = () => {
    temporizador = setTimeout(async () => {
      if (!activo) return;
      try {
        await bridge.dismissDialogs();
      } catch {
        // Sin bridge para contestar, la operacion sigue su curso y fallara por su cuenta.
      }
      if (activo) programar();
    }, cadaMs);
  };
  programar();
  try {
    return await operacion();
  } finally {
    activo = false;
    if (temporizador) clearTimeout(temporizador);
  }
}
