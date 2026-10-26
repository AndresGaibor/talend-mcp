import { existsSync, rmSync } from "node:fs";

import { conRutas } from "./testdata-paths";
import { compilarEnStudio } from "./studio-compile";
import { compilando, errorDe, esperar } from "./studio-retry";
import type { Bridge, Escenario } from "./scenario-types";

/**
 * Ejecucion del job en Studio y lectura de su salida.
 *
 * Primero se compila con el Run (deja el `classpath.jar`); despues se relanza
 * para capturar lo que imprime.
 */

export type SalidaJob = { ok: true; lineas: string[] } | { ok: false; mensaje: string };

export async function ejecutarJob(bridge: Bridge, escenario: Escenario): Promise<SalidaJob> {
  const compilado = await compilarEnStudio(bridge, escenario.job);
  if (!compilado.ok) {
    return { ok: false, mensaje: compilado.mensaje ?? "no se pudo compilar el job" };
  }

  // El fichero de salida se borra entre el Run de Studio (que ya ha escrito
  // el fichero) y el relanzamiento: el tFileOutputDelimited se niega a
  // sobrescribir un fichero que ya existe.
  if (escenario.espera?.fichero) {
    const ruta = conRutas(escenario.espera.fichero.ruta);
    if (existsSync(ruta)) rmSync(ruta, { force: true });
  }

  let ejecutado = await bridge.executeJob({
    name: escenario.job,
    context: escenario.contexto,
    timeoutMs: 180_000,
  });
  for (let intento = 0; intento < 24; intento++) {
    const cuerpo = (ejecutado.data ?? {}) as { result?: { error?: string }; error?: string };
    const error = cuerpo.result?.error ?? cuerpo.error ?? "";
    if (!compilando(error)) break;
    await esperar(5000);
    ejecutado = await bridge.executeJob({
      name: escenario.job,
      context: escenario.contexto,
      timeoutMs: 180_000,
    });
  }
  if (!ejecutado.ok) {
    return { ok: false, mensaje: `no se pudo ejecutar: ${errorDe(ejecutado)}` };
  }

  const datos = (ejecutado.data ?? {}) as {
    result?: { exitCode?: number | null; lines?: string[]; stdout?: string; error?: string };
    exitCode?: number;
    lines?: string[];
    stdout?: string;
    error?: string;
  };
  const cuerpo = (datos.result ?? datos) as {
    exitCode?: number | null;
    lines?: string[];
    stdout?: string;
    error?: string;
  };
  const lineas = cuerpo.lines ?? (cuerpo.stdout ?? "").split("\n").filter((linea) => linea.length > 0);

  if (cuerpo.error) {
    return { ok: false, mensaje: `error al ejecutar: ${cuerpo.error}` };
  }
  if (cuerpo.exitCode !== undefined && cuerpo.exitCode !== null && cuerpo.exitCode !== 0) {
    // Un job puede terminar en error a proposito: lo que importa es que el
    // trigger de error se ejecuto (su salida se comprueba despues).
    if (!escenario.espera?.error_esperado) {
      return {
        ok: false,
        mensaje: `salida con codigo ${cuerpo.exitCode}: ${lineas.slice(0, 3).join(" | ")}`,
      };
    }
  }

  return { ok: true, lineas };
}
