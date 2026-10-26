import type { createBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";

/**
 * Contrato de los escenarios L5 y de los resultados del arnes.
 *
 * Los tipos viven aparte para que los modulos de montaje, ejecucion y
 * comparacion compartan la misma forma sin arrastrar imports de Studio.
 */

/** Cliente del bridge, inferido para no repetir la firma en cada modulo. */
export type Bridge = Awaited<ReturnType<typeof createBridgeClient>>;

/** Definiciones de componentes, indice con el que se elige el conector. */
export type Definiciones = Map<string, ComponentDefinition>;

/**
 * `length` es la longitud del tipo de texto. Sin ella Talend genera VARCHAR(-1)
 * en los CREATE TABLE (DROP_CREATE y DROP_IF_EXISTS_AND_CREATE), que Postgres rechaza.
 */
export type Columna = { name: string; type: string; length?: number };

export type Conexion = { origen: string; destino: string; tipo?: string };

export type Nodo = {
  type: string;
  /** Nombre con el que se le conoce en las conexiones. */
  nombre?: string;
  parameters?: Record<string, { value: string | Array<Record<string, string>>; literal?: boolean }>;
  /** Columnas del nodo, en su conector principal. */
  columnas?: Columna[];
  /**
   * Columnas en otros conectores del nodo.
   *
   * El `tUniqRow` saca sus filas por el conector `UNIQUE`, y su schema de
   * salida va ahi: si no se pone, el codigo generado no tiene struct de
   * salida ("monto cannot be resolved or is not a field").
   */
  columnasPorConector?: Record<string, Columna[]>;
  /**
   * Tablas de metadata tal cual, para los componentes con varios conectores
   * de datos (el `tAggregateRow` tiene la de entrada y la de salida).
   *
   * La tabla de entrada del `tAggregateRow` se llama como la conexion
   * ("row1"), porque sus tablas la referencian asi ("row1.ciudad").
   */
  esquemas?: Array<{ conector: string; nombre: string; columnas: Columna[] }>;
  /** Filas del `tFixedFlowInput`. */
  values?: string[][];
  /** Tablas del componente (UNIQUE_KEY, GROUPBYS, CRITERIA...). */
  tablas?: Record<string, { columns?: string[]; rows: Array<string[] | Record<string, string>> }>;
  /**
   * Poner el schema despues de conectar.
   *
   * Lo necesitan los componentes con varias tablas de datos en el mismo
   * conector (el `tAggregateRow`): al conectar, Talend rehace las tablas y
   * deja vacia la de salida.
   */
  schemaDespuesDeConectar?: boolean;
  /**
   * Modelo del `tMap`: las tablas de entrada (una por conexion), las de salida
   * (con la expresion de cada columna) y las variables.
   *
   * Se aplica **despues de conectar**, porque las columnas de entrada las
   * necesita el `tMap` para poder evaluar las expresiones.
   */
  mapper?: {
    inputs?: Array<{
      name: string;
      matchingMode?: string;
      lookupMode?: string;
      columns?: Columna[];
      filter?: string;
    }>;
    outputs?: Array<{
      name: string;
      reject?: boolean;
      columns?: Array<Columna & { expression?: string }>;
      filter?: string;
    }>;
    vars?: Array<{ name: string; type?: string; expression?: string }>;
  };
};

export type Contexto = {
  nombre: string;
  variables?: Array<{ nombre: string; valor: string; tipo?: string }>;
};

export type EsperaFichero = { ruta: string; lineas?: number | string[]; contiene?: string[] };

export type Espera = {
  /** Lineas exactas de la salida del job, o solo cuantas lineas. */
  lineas?: string[] | number;
  /** Lineas que tienen que aparecer. */
  contiene?: string[];
  /** Fichero que el job escribe. */
  fichero?: EsperaFichero;
  /** Los contextos que tiene que tener el job, con sus variables. */
  contextos?: Array<{ nombre: string; variables: Array<{ nombre: string; valor: string }> }>;
  /** El job termina en error a proposito (un trigger de error, por ejemplo). */
  error_esperado?: boolean;
  /**
   * Consulta a la base de datos de pruebas despues de ejecutar.
   *
   * Es la forma de comprobar lo que el job escribe en una base de datos:
   * el `tDBOutput` no saca filas, asi que no hay nada que mirar en la salida.
   */
  consulta?: { sql: string; valor: string | number };
};

export type Escenario = {
  nombre: string;
  /** Nombre del job de pruebas en el proyecto de Studio. */
  job: string;
  /** Escenario conocido pero todavia sin resolver: se informa y se salta. */
  pendiente?: string;
  /**
   * Contextos (entornos) del job y sus variables.
   *
   * Se crean con la API de Studio: el job se guarda con sus entornos y sus
   * valores, como si los hubiera hecho el IDE.
   */
  contextos?: Contexto[];
  /** Contexto con el que se ejecuta el job (por defecto, el de Studio). */
  contexto?: string;
  /**
   * Jobs auxiliares (el hijo de un `tRunJob`, por ejemplo). Se montan antes
   * del job principal.
   */
  jobs?: Array<{
    job: string;
    nodos: Nodo[];
    conexiones: Conexion[];
  }>;
  nodos: Nodo[];
  conexiones: Conexion[];
  /**
   * SQL que se ejecuta en el Postgres de pruebas **antes** del job.
   *
   * Sirve para dejar la tabla como el escenario la necesita: el UPDATE y el
   * DELETE solo tienen sentido si ya hay filas.
   */
  prepara?: string[];
  /** Que se espera al ejecutar. */
  espera?: Espera;
};

/** Resultado de montar o ejecutar un escenario. */
export type Resultado = { ejecutaOk: boolean; salidaCorrecta: boolean; mensaje?: string };

/** Resultado de un paso intermedio (montar, compilar, conectar...). */
export type Paso = { ok: boolean; mensaje?: string };

/** Especificacion de un job a montar (el principal o uno auxiliar). */
export type JobSpec = {
  job: string;
  nodos: Nodo[];
  conexiones: Conexion[];
  contextos?: Contexto[];
};
