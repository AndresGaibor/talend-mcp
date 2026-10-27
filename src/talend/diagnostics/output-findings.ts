/**
 * Avisos y errores que un job deja aunque termine bien.
 *
 * Un job puede salir con codigo 0 y llevar `[ERROR]` en su salida o avisos de
 * diseno en la vista Problemas de Studio. Estas funciones los separan para que
 * el informe los muestre y, en el caso de los errores, el escenario falle.
 */

export type Hallazgos = { errores: string[]; avisos: string[] };

const LINEA_ERROR = /^\s*\[(ERROR|FATAL)\s*\]|^Exception in thread|^Caused by:/;
const LINEA_AVISO = /^\s*\[WARN\s*\]/;

/** Un problema de la vista Problemas, tal como lo devuelve `talend_job_problems`. */
export type ProblemaDiseno = {
  severity?: string;
  node?: string;
  description?: string;
};

/**
 * Los problemas dentro de la respuesta de `/automation/job/problems`. El bridge los
 * puede entregar en `result.problems` (sobre completo) o en `problems` (ya sin sobre).
 */
export function problemasDe(data: unknown): ProblemaDiseno[] {
  const cuerpo = (data ?? {}) as { result?: { problems?: unknown }; problems?: unknown };
  const lista = cuerpo.result?.problems ?? cuerpo.problems;
  return Array.isArray(lista) ? (lista as ProblemaDiseno[]) : [];
}

/** Separa las lineas de la salida (stdout y stderr) en errores y avisos. */
export function clasificarSalida(lineas: string[]): Hallazgos {
  const errores: string[] = [];
  const avisos: string[] = [];
  for (const linea of lineas) {
    if (LINEA_ERROR.test(linea)) errores.push(linea.trim());
    else if (LINEA_AVISO.test(linea)) avisos.push(linea.trim());
  }
  return { errores, avisos };
}

/** Separa los problemas de diseno en errores y avisos (los `INFO` no cuentan). */
export function clasificarProblemas(problemas: ProblemaDiseno[]): Hallazgos {
  const errores: string[] = [];
  const avisos: string[] = [];
  for (const problema of problemas) {
    const texto = `${problema.node ?? "?"}: ${problema.description ?? "sin descripcion"}`;
    if (problema.severity === "ERROR") errores.push(texto);
    else if (problema.severity === "WARNING") avisos.push(texto);
  }
  return { errores, avisos };
}

/** Quita los hallazgos que el escenario declara como esperados (por fragmento de texto). */
export function sinTolerados(hallazgos: Hallazgos, tolerados: string[] = []): Hallazgos {
  const tolerado = (linea: string) => tolerados.some((fragmento) => linea.includes(fragmento));
  return {
    errores: hallazgos.errores.filter((linea) => !tolerado(linea)),
    avisos: hallazgos.avisos.filter((linea) => !tolerado(linea)),
  };
}

export function juntar(...grupos: Hallazgos[]): Hallazgos {
  return {
    errores: grupos.flatMap((grupo) => grupo.errores),
    avisos: grupos.flatMap((grupo) => grupo.avisos),
  };
}

/** Una linea para el informe: cuantos hay y los primeros, cortados. */
export function resumir(etiqueta: string, lineas: string[], max = 3): string {
  if (lineas.length === 0) return "";
  const primeras = lineas.slice(0, max).map((linea) => linea.slice(0, 160));
  const resto = lineas.length > max ? ` (+${lineas.length - max} mas)` : "";
  return `${etiqueta} (${lineas.length}): ${primeras.join(" | ")}${resto}`;
}
