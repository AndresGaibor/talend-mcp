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

  validarComponentes(value, path, problems);

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

/** Componentes de fichero delimitado: el FILENAME y el esquema son lo que mas falla. */
const COMPONENTES_DE_FICHERO = new Set(["tFileInputDelimited", "tFileOutputDelimited"]);

/**
 * Reglas por componente: lo que Studio necesita para generar un codigo que compile.
 *
 * Las fallas que encuentra el agente al probar (un fichero sin FILENAME, un
 * lector sin esquema, un tMap cuyo modelo no encaja con sus conexiones) se
 * detectan aqui, antes de montar nada, con el nombre del nodo y el arreglo.
 */
function validarComponentes(value: Record<string, unknown>, path: string, problems: string[]): void {
  const nodos = Array.isArray(value.nodos) ? value.nodos.filter(isRecord) : [];
  const conexiones = Array.isArray(value.conexiones) ? value.conexiones.filter(isRecord) : undefined;

  for (const nodo of nodos) {
    const tipo = nodo.type;
    const nombre = nodo.nombre;
    if (!isNonEmptyString(tipo) || !isNonEmptyString(nombre)) continue;

    const entradas = conexiones?.filter((conexion) => conexion.destino === nombre).length;
    const salidas = conexiones?.filter((conexion) => conexion.origen === nombre).length;

    if (COMPONENTES_DE_FICHERO.has(tipo)) {
      validarFichero({ nodo, tipo, nombre, path, problems, entradas });
    }
    if (tipo === "tMap") {
      validarTMap({ nodo, nombre, path, problems, entradas, salidas });
    }
  }
}

function validarFichero(opciones: {
  nodo: Record<string, unknown>;
  tipo: string;
  nombre: string;
  path: string;
  problems: string[];
  entradas?: number;
}): void {
  const { nodo, tipo, nombre, path, problems, entradas } = opciones;

  if (!tieneParametro(nodo, "FILENAME")) {
    problems.push(
      `${path}: "${nombre}" (${tipo}) no tiene FILENAME, la ruta del fichero. Sin ella el job no compila ` +
        `("The constructor File() is undefined"). Agrega parameters.FILENAME con la ruta.`,
    );
  }
  if (tipo === "tFileInputDelimited" && !tieneEsquema(nodo)) {
    problems.push(
      `${path}: "${nombre}" (tFileInputDelimited) no tiene columnas: sin esquema no sabe que campos leer. ` +
        `Declara "columnas" con name y type de cada campo.`,
    );
  }
  if (tipo === "tFileOutputDelimited" && entradas === 0) {
    problems.push(
      `${path}: "${nombre}" (tFileOutputDelimited) no tiene entrada: no le llega ninguna fila. ` +
        `Conectale el origen en "conexiones".`,
    );
  }
}

/**
 * Si el nodo declara columnas: en `columnas` (conector principal) o en alguna
 * tabla de `esquemas`. Son las dos formas que admite el escenario.
 */
function tieneEsquema(nodo: Record<string, unknown>): boolean {
  if (Array.isArray(nodo.columnas) && nodo.columnas.length > 0) return true;
  return Array.isArray(nodo.esquemas) && nodo.esquemas.some(
    (tabla) => isRecord(tabla) && Array.isArray(tabla.columnas) && tabla.columnas.length > 0,
  );
}

/** Si el nodo tiene el parametro con un valor de texto no vacio. */
function tieneParametro(nodo: Record<string, unknown>, clave: string): boolean {
  const parametros = nodo.parameters;
  if (!isRecord(parametros) || !isRecord(parametros[clave])) return false;
  return isNonEmptyString((parametros[clave] as Record<string, unknown>).value);
}

/**
 * Modelo del tMap contra sus conexiones.
 *
 * Cada conexion de entrada necesita una tabla en `inputs`, y cada conexion de
 * salida una en `outputs`, con el mismo nombre que la conexion. Las conexiones
 * las pone Studio (`row1`, `row2`...); el nombre que no coincide con ninguna
 * deja las expresiones sin destino.
 */
function validarTMap(opciones: {
  nodo: Record<string, unknown>;
  nombre: string;
  path: string;
  problems: string[];
  entradas?: number;
  salidas?: number;
}): void {
  const { nodo, nombre, path, problems, entradas, salidas } = opciones;

  if (!isRecord(nodo.mapper)) {
    problems.push(
      `${path}: "${nombre}" (tMap) no tiene "mapper": sin modelo el tMap no tiene entradas, salidas ni expresiones.`,
    );
    return;
  }
  const mapper = nodo.mapper;

  validarTablasDeTMap({ tablas: mapper.inputs, clave: "inputs", tipo: "entrada", nombre, path, problems, conexiones: entradas });
  validarTablasDeTMap({ tablas: mapper.outputs, clave: "outputs", tipo: "salida", nombre, path, problems, conexiones: salidas });
  validarVariablesDeTMap(mapper.vars, nombre, path, problems);
}

function validarTablasDeTMap(opciones: {
  tablas: unknown;
  clave: "inputs" | "outputs";
  tipo: "entrada" | "salida";
  nombre: string;
  path: string;
  problems: string[];
  conexiones?: number;
}): void {
  const { tablas, clave, tipo, nombre, path, problems, conexiones } = opciones;

  if (tablas !== undefined && !Array.isArray(tablas)) {
    problems.push(`${path}: mapper.${clave} de "${nombre}" tiene que ser una lista de tablas.`);
    return;
  }
  const lista = Array.isArray(tablas) ? tablas : [];

  if (conexiones !== undefined && lista.length !== conexiones) {
    problems.push(
      `${path}: "${nombre}" (tMap) declara ${lista.length} ${tipo}(s) en mapper.${clave} pero tiene ` +
        `${conexiones} conexion(es) de ${tipo}. Hay una tabla por conexion, con el mismo nombre que la conexion.`,
    );
  }

  const vistas = new Set<string>();
  lista.forEach((tabla, indice) => {
    if (!isRecord(tabla) || !isNonEmptyString(tabla.name)) {
      problems.push(`${path}: mapper.${clave}[${indice}] de "${nombre}" no tiene "name" (el nombre de la conexion).`);
      return;
    }
    if (vistas.has(tabla.name)) {
      problems.push(`${path}: mapper.${clave} de "${nombre}" repite la tabla "${tabla.name}".`);
    }
    vistas.add(tabla.name);

    if (!Array.isArray(tabla.columns) || tabla.columns.length === 0) {
      const consejo = tipo === "salida" ? "con name, type y expression" : "con name y type";
      problems.push(
        `${path}: la ${tipo} "${tabla.name}" del tMap "${nombre}" no tiene columns: sin esquema no hay nada que mapear. ` +
          `Declara sus columnas ${consejo}.`,
      );
    }
  });
}

function validarVariablesDeTMap(vars: unknown, nombre: string, path: string, problems: string[]): void {
  if (vars === undefined) return;
  if (!Array.isArray(vars)) {
    problems.push(`${path}: mapper.vars de "${nombre}" tiene que ser una lista de variables.`);
    return;
  }
  vars.forEach((variable, indice) => {
    if (!isRecord(variable) || !isNonEmptyString(variable.name)) {
      problems.push(`${path}: mapper.vars[${indice}] de "${nombre}" no tiene "name".`);
      return;
    }
    if (variable.columns !== undefined) {
      problems.push(
        `${path}: la variable "${variable.name}" del tMap "${nombre}" usa "columns". ` +
          `En vars cada entrada es una variable con name, type y expression.`,
      );
    }
  });
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
