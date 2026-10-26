import { suiteOf } from "./scenario-selection";

/**
 * Validacion de un escenario L5.
 *
 * Se ejecuta antes de montar nada: un fixture mal escrito tiene que fallar con
 * un mensaje que diga el archivo y el campo, no con un error de Talend Studio
 * tres pasos mas adelante.
 */

export type ScenarioIssue = { path: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type ValidateOptions = {
  /** Suite (carpeta) en la que esta el archivo. */
  suite?: string;
  /** Ruta del archivo, para el mensaje. */
  path?: string;
};

/** Problemas del escenario; lista vacia si esta bien formado. */
export function validateScenario(value: unknown, options: ValidateOptions = {}): string[] {
  const path = options.path ?? "escenario";
  if (!isRecord(value)) return [`${path}: tiene que ser un objeto JSON con los campos del escenario`];

  const problems: string[] = [];

  const nombre = value.nombre;
  if (!isNonEmptyString(nombre)) {
    problems.push(`${path}: falta "nombre" (formato "categoria: descripcion")`);
  } else {
    if (!nombre.includes(":")) {
      problems.push(`${path}: el nombre "${nombre}" no tiene categoria (formato "categoria: descripcion")`);
    }
    if (options.suite) {
      const suite = suiteOf(nombre);
      if (suite !== options.suite && suite !== "otros") {
        problems.push(`${path}: "${nombre}" pertenece a la suite "${suite}", no a "${options.suite}"`);
      }
    }
  }

  if (!isNonEmptyString(value.job)) problems.push(`${path}: falta "job" con el nombre del job a montar`);

  const nodos = value.nodos;
  const nombresNodo = new Set<string>();
  if (!Array.isArray(nodos) || nodos.length === 0) {
    problems.push(`${path}: falta "nodos" con al menos un componente`);
  } else {
    nodos.forEach((nodo, index) => {
      if (!isRecord(nodo) || !isNonEmptyString(nodo.type)) {
        problems.push(`${path}: nodos[${index}] no tiene "type"`);
        return;
      }
      if (!isNonEmptyString(nodo.nombre)) {
        problems.push(`${path}: nodos[${index}] ("${nodo.type}") no tiene "nombre"`);
        return;
      }
      if (nombresNodo.has(nodo.nombre)) {
        problems.push(`${path}: el nombre de nodo "${nodo.nombre}" esta repetido`);
        return;
      }
      nombresNodo.add(nodo.nombre);
    });
  }

  if (value.conexiones !== undefined) {
    if (!Array.isArray(value.conexiones)) {
      problems.push(`${path}: "conexiones" tiene que ser una lista`);
    } else {
      value.conexiones.forEach((conexion, index) => {
        if (
          !isRecord(conexion) ||
          !isNonEmptyString(conexion.origen) ||
          !isNonEmptyString(conexion.destino)
        ) {
          problems.push(`${path}: conexiones[${index}] necesita "origen" y "destino"`);
          return;
        }
        if (conexion.origen === conexion.destino) {
          problems.push(`${path}: conexiones[${index}] conecta "${conexion.origen}" consigo mismo`);
        }
        // Una conexion a un nodo que no existe se descubre al montar el job con
        // un error de Studio; aqui se corta con el nombre exacto.
        if (nombresNodo.size > 0) {
          if (!nombresNodo.has(conexion.origen)) {
            problems.push(`${path}: conexiones[${index}] apunta a un origen inexistente: "${conexion.origen}"`);
          }
          if (!nombresNodo.has(conexion.destino)) {
            problems.push(`${path}: conexiones[${index}] apunta a un destino inexistente: "${conexion.destino}"`);
          }
        }
      });
    }
  }

  if (value.pendiente !== undefined && !isNonEmptyString(value.pendiente)) {
    problems.push(`${path}: "pendiente" tiene que explicar que falta`);
  }

  if (value.espera !== undefined) {
    if (!isRecord(value.espera)) {
      problems.push(`${path}: "espera" tiene que ser un objeto con lo que se comprueba`);
    } else {
      validarEspera(value.espera, path, problems);
    }
  }

  return problems;
}

function esListaDeTexto(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

/** Tipos de las comprobaciones conocidas de `espera`; las demas claves pasan. */
function validarEspera(espera: Record<string, unknown>, path: string, problems: string[]): void {
  if (espera.contiene !== undefined && !esListaDeTexto(espera.contiene)) {
    problems.push(`${path}: "espera.contiene" tiene que ser una lista de textos`);
  }
  if (espera.lineas !== undefined) {
    const lineas = espera.lineas;
    const valido = typeof lineas === "number" || esListaDeTexto(lineas);
    if (!valido) problems.push(`${path}: "espera.lineas" tiene que ser un numero o una lista de textos`);
  }
  if (espera.error_esperado !== undefined && typeof espera.error_esperado !== "boolean") {
    problems.push(`${path}: "espera.error_esperado" tiene que ser true o false`);
  }
  if (espera.fichero !== undefined && !isRecord(espera.fichero)) {
    problems.push(`${path}: "espera.fichero" tiene que ser un objeto`);
  }
  if (espera.consulta !== undefined && !isRecord(espera.consulta)) {
    problems.push(`${path}: "espera.consulta" tiene que ser un objeto`);
  }
  if (espera.contextos !== undefined && !Array.isArray(espera.contextos)) {
    problems.push(`${path}: "espera.contextos" tiene que ser una lista`);
  }
}
