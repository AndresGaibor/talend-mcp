import type { Bridge, Paso } from "./scenario-types";
import { errorDe } from "./studio-retry";
import type { Pendientes } from "./job-nodes";

/**
 * Conexiones y configuracion que va despues de conectar.
 *
 * Orden: primero las conexiones, luego los schemas que Talend descoloca al
 * conectar, y al final las tablas y el modelo del `tMap`, que necesitan las
 * columnas de entrada de la conexion.
 */

export type PlanConexiones = {
  connections: Array<{ source: string; target: string; type?: string }>;
  afterConnect: { schemas: string[]; tables: string[]; mappers: string[] };
};

/** Conecta los nodos traduciendo los alias del plan a nombres unicos. */
export async function conectarNodos(
  bridge: Bridge,
  job: string,
  plan: PlanConexiones,
  nombres: ReadonlyMap<string, string>,
): Promise<Paso> {
  for (const conexion of plan.connections) {
    const origen = nombres.get(conexion.source);
    const destino = nombres.get(conexion.target);
    if (!origen || !destino) {
      return { ok: false, mensaje: `conexion sin nodos: ${conexion.source} -> ${conexion.target}` };
    }
    const conectada = await bridge.connectNodes({ job, source: origen, target: destino, type: conexion.type });
    if (!conectada.ok) {
      return {
        ok: false,
        mensaje: `no se pudo conectar ${conexion.source} -> ${conexion.target}: ${errorDe(conectada)}`,
      };
    }
  }
  return { ok: true };
}

/**
 * Repone schemas, tablas y mappers despues de conectar.
 *
 * Al conectar, Talend propaga el esquema del destino hacia atras, asi que el
 * origen se queda con las columnas del destino. Por eso los esquemas "despues"
 * de los nodos que son origen de alguna conexion van los ultimos: son los que
 * se han quedado descolocados.
 */
export async function aplicarPendientes(
  bridge: Bridge,
  job: string,
  plan: PlanConexiones,
  pendientes: Pendientes,
): Promise<Paso> {
  const orden = new Map(plan.afterConnect.schemas.map((nombre, indice) => [nombre, indice]));
  const ordenados = [...pendientes.esquemas].sort(
    (a, b) =>
      (orden.get(a.nombre) ?? Number.MAX_SAFE_INTEGER) - (orden.get(b.nombre) ?? Number.MAX_SAFE_INTEGER),
  );

  for (const pendiente of ordenados) {
    if (pendiente.values) {
      const conDatos = await bridge.setNodeSchema({
        job,
        uniqueName: pendiente.uniqueName,
        columns: pendiente.columns ?? [],
        values: pendiente.values,
      });
      if (!conDatos.ok) {
        return { ok: false, mensaje: `no se pudieron reponer los datos: ${errorDe(conDatos)}` };
      }
      continue;
    }
    const conSchema = await bridge.configureNode({
      job,
      uniqueName: pendiente.uniqueName,
      schema: pendiente.schema as never,
    });
    if (!conSchema.ok) {
      return { ok: false, mensaje: `no se pudo poner el schema: ${errorDe(conSchema)}` };
    }
  }

  const tablasPorNombre = new Map(pendientes.tablas.map((pendiente) => [pendiente.nombre, pendiente]));
  for (const nombre of plan.afterConnect.tables) {
    const pendiente = tablasPorNombre.get(nombre);
    if (!pendiente) continue;
    const conTablas = await bridge.configureNode({
      job,
      uniqueName: pendiente.uniqueName,
      tables: pendiente.tablas,
    });
    if (!conTablas.ok) {
      return { ok: false, mensaje: `no se pudieron poner las tablas: ${errorDe(conTablas)}` };
    }
  }

  const mappersPorNombre = new Map(pendientes.mappers.map((pendiente) => [pendiente.nombre, pendiente]));
  for (const nombre of plan.afterConnect.mappers) {
    const pendiente = mappersPorNombre.get(nombre);
    if (!pendiente) continue;
    const conMapper = await bridge.configureNode({
      job,
      uniqueName: pendiente.uniqueName,
      mapper: pendiente.mapper as unknown as Record<string, unknown>,
    });
    if (!conMapper.ok) {
      return { ok: false, mensaje: `no se pudo poner el modelo del tMap: ${errorDe(conMapper)}` };
    }
  }

  return { ok: true };
}
