import type { Bridge, Columna, Nodo, Paso } from "./scenario-types";
import { conRutas } from "./testdata-paths";
import { errorDe, esperar, transitorioDeStudio } from "./studio-retry";

/**
 * Filas de datos de un componente con las rutas resueltas. Las celdas son datos del
 * escenario: si un `@TESTDATA@` no se sustituye aqui, Studio escribe o lee en una ruta
 * relativa al cwd y aparece una carpeta literal `@TESTDATA@` en el repo.
 */
export function datosConRutas(filas: string[][]): string[][] {
  return filas.map((fila) => fila.map((celda) => conRutas(celda)));
}

/**
 * Nodos del job: alta en Studio y primer schema.
 *
 * El schema de los componentes que lo piden despues de conectar no se aplica
 * aqui: se devuelve como pendiente para que el montador lo repita al final.
 */

export type PendienteSchema = {
  uniqueName: string;
  nombre: string;
  schema: unknown[];
  columns?: Columna[];
  values?: string[][];
};

export type PendienteTablas = {
  nombre: string;
  uniqueName: string;
  tablas: NonNullable<Nodo["tablas"]>;
};

export type PendienteMapper = {
  nombre: string;
  uniqueName: string;
  mapper: NonNullable<Nodo["mapper"]>;
};

export type Pendientes = {
  esquemas: PendienteSchema[];
  tablas: PendienteTablas[];
  mappers: PendienteMapper[];
};

/** Estructura vacia de pendientes para un job. */
export function pendientesVacios(): Pendientes {
  return { esquemas: [], tablas: [], mappers: [] };
}

/**
 * Parametros del nodo con las rutas y los alias resueltos.
 *
 * `@uniqueName:<nodo>` es el nombre unico de otro nodo del job (el
 * `tPostgresqlInput` necesita el de su conexion).
 */
export function parametrosDe(
  nodo: Nodo,
  nombres: ReadonlyMap<string, string>,
): Nodo["parameters"] | undefined {
  if (!nodo.parameters) return undefined;
  return Object.fromEntries(
    Object.entries(nodo.parameters).map(([clave, valor]) => [
      clave,
      {
        value: Array.isArray(valor.value)
          ? valor.value
          : conRutas(valor.value).replace(
              /@uniqueName:([A-Za-z0-9_]+)/g,
              (_, nombre: string) => nombres.get(nombre) ?? `@uniqueName:${nombre}`,
            ),
        literal: valor.literal,
      },
    ]),
  );
}

/**
 * Schema del nodo en sus conectores.
 *
 * Si el nodo declara `esquemas` se usan tal cual (varios conectores de datos);
 * si no, el principal va en `FLOW` y los demas en `columnasPorConector` (el
 * `tUniqRow` saca sus filas por `UNIQUE`).
 */
export function schemaDe(nodo: Nodo, uniqueName: string): Array<{ connector: string; name: string; columns: Columna[] }> {
  if (nodo.esquemas) {
    return nodo.esquemas.map((tabla) => ({
      connector: tabla.conector,
      // "@uniqueName" es el nombre unico del nodo.
      name: tabla.nombre === "@uniqueName" ? uniqueName : tabla.nombre,
      columns: tabla.columnas,
    }));
  }
  return [
    ...(nodo.columnas ? [{ connector: "FLOW", name: uniqueName, columns: nodo.columnas }] : []),
    ...Object.entries(nodo.columnasPorConector ?? {}).map(([connector, columnas]) => ({
      connector,
      name: uniqueName,
      columns: columnas,
    })),
  ];
}

/**
 * Anade el nodo y devuelve su nombre unico.
 *
 * Dos fallos transitorios de Studio: contesta `ok` sin el nodo (esta
 * terminando un build) o no consigue abrir el job en el editor. En los dos
 * casos se reabre el job y se reintenta antes de dar el escenario por perdido.
 * La espera es fija porque el fallo tipico es que Studio todavia esta cerrando
 * el job anterior.
 */
export async function anadirNodo(
  bridge: Bridge,
  job: string,
  nodo: Nodo,
  parameters: Nodo["parameters"],
): Promise<{ ok: true; uniqueName: string } | { ok: false; mensaje: string }> {
  let anadido = await bridge.addNode({ type: nodo.type, job, parameters });

  for (let intento = 0; intento < 10; intento++) {
    if (anadido.ok) {
      // El bridge envuelve la respuesta en `result`.
      const cuerpo = (anadido.data ?? {}) as {
        uniqueName?: string;
        result?: { uniqueName?: string };
      };
      const uniqueName = String(cuerpo.uniqueName ?? cuerpo.result?.uniqueName ?? "");
      if (uniqueName) return { ok: true, uniqueName };
    } else if (!transitorioDeStudio(errorDe(anadido))) {
      return { ok: false, mensaje: `no se pudo anadir ${nodo.type}: ${errorDe(anadido)}` };
    }

    await esperar(5000);
    await bridge.openJob({ name: job });
    anadido = await bridge.addNode({ type: nodo.type, job, parameters });
  }

  return {
    ok: false,
    mensaje: `el bridge no devolvio el nombre del nodo ${nodo.type}: ${anadido.rawText?.slice(0, 200) ?? ""}`,
  };
}

/**
 * Primer schema del nodo: los datos del `tFixedFlowInput` o las columnas.
 *
 * Deja en `pendientes` el schema que hay que reponer despues de conectar.
 */
export async function ponerSchemaInicial(
  bridge: Bridge,
  job: string,
  nodo: Nodo,
  uniqueName: string,
  nombrePlan: string,
  pendientes: Pendientes,
): Promise<Paso> {
  if (!nodo.columnas && !nodo.columnasPorConector && !nodo.esquemas) return { ok: true };

  if (nodo.values) {
    // El `tFixedFlowInput` lleva las filas en su tabla: se ponen con el
    // schema, que es como lo hace el IDE.
    const conDatos = await bridge.setNodeSchema({
      job,
      uniqueName,
      columns: nodo.columnas ?? [],
      values: datosConRutas(nodo.values),
    });
    if (!conDatos.ok) {
      return { ok: false, mensaje: `no se pudieron poner los datos a ${nodo.type}: ${errorDe(conDatos)}` };
    }
    if (nodo.schemaDespuesDeConectar) {
      // Los nodos con filas tambien se reponen despues de conectar: al
      // conectar, el esquema del destino se propaga hacia atras y el
      // origen se queda con las columnas del destino.
      pendientes.esquemas.push({
        uniqueName,
        nombre: nombrePlan,
        schema: [],
        columns: nodo.columnas ?? [],
        values: datosConRutas(nodo.values),
      });
    }
    return { ok: true };
  }

  // El schema va en su conector y, si el nodo tiene mas de un conector de
  // datos, tambien en los demas: el `tUniqRow` tiene el de salida en UNIQUE.
  const schema = schemaDe(nodo, uniqueName);
  const conSchema = await bridge.configureNode({ job, uniqueName, schema });
  if (!conSchema.ok) {
    return { ok: false, mensaje: `no se pudo poner el schema de ${nodo.type}: ${errorDe(conSchema)}` };
  }
  if (nodo.schemaDespuesDeConectar) {
    pendientes.esquemas.push({ uniqueName, nombre: nombrePlan, schema });
  }
  return { ok: true };
}
