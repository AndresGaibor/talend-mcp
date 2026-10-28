import {
  acceptsInput,
  comprobarConexion,
  dataConnectors,
} from "../../modules/component-definitions/application/validate-connection.use-case";
import type { ComponentDefinition } from "../../modules/component-definitions/domain/component-definition.types";

type ComponenteDePlantilla = { uniqueName: string; componentName: string };
type ConexionDePlantilla = { source: string; target: string; label: string; connectorName?: string };

const DISPARADORES = new Set(["SUBJOB_OK", "SUBJOB_ERROR", "COMPONENT_OK", "COMPONENT_ERROR", "RUN_IF"]);

/** Los componentes que admiten un numero cualquiera de conexiones por el mismo conector. */
const SIN_LIMITE = new Set(["tmap", "tunite", "treplicate"]);

/**
 * Comprueba las conexiones de datos de una plantilla contra las definiciones de Studio, antes de escribir el Job.
 *
 * Studio no rechaza una conexion que no puede existir: carga el Job y muestra un aviso (o la deja sin filas). Con las
 * definiciones del XML de cada componente se sabe antes: que el origen tenga ese conector de salida, que el destino
 * acepte entradas por ahi y que no se pase del maximo de conexiones que admite cada conector.
 *
 * @param buscar definicion de un componente por nombre (null si Studio no la tiene; esos no se comprueban).
 * @returns los errores que impiden escribir el Job.
 */
export async function comprobarConexiones(
  plantilla: { components: ComponenteDePlantilla[]; connections?: ConexionDePlantilla[] },
  buscar: (componentName: string) => Promise<ComponentDefinition | null>,
): Promise<string[]> {
  const tipos = new Map(plantilla.components.map((componente) => [componente.uniqueName, componente.componentName]));
  const cache = new Map<string, Promise<ComponentDefinition | null>>();
  const definicionDe = (nombre: string) => {
    if (!cache.has(nombre)) cache.set(nombre, buscar(nombre).catch(() => null));
    return cache.get(nombre)!;
  };

  const errores: string[] = [];
  const salidas = new Map<string, number>();
  const entradas = new Map<string, number>();

  for (const conexion of plantilla.connections ?? []) {
    const conector = (conexion.connectorName ?? "FLOW").toUpperCase();
    if (DISPARADORES.has(conector)) continue;
    const tipoOrigen = tipos.get(conexion.source);
    const tipoDestino = tipos.get(conexion.target);
    if (!tipoOrigen || !tipoDestino) continue; // un nodo que no existe ya lo rechaza validateJobSpec

    const origen = await definicionDe(tipoOrigen);
    const destino = await definicionDe(tipoDestino);
    const comprobacion = comprobarConexion({ source: origen, target: destino, sourceType: tipoOrigen, targetType: tipoDestino, connector: conector });
    for (const error of comprobacion.errors) {
      errores.push(`conexion '${conexion.label}' (${conexion.source} -> ${conexion.target}): ${error}`);
    }
    if (!origen || !destino || !comprobacion.ok) continue;

    // Cada conector admite un maximo de conexiones: el FLOW de un tFilterRow, una; el de un tMap, las que sean.
    const claveSalida = `${conexion.source}|${conector}`;
    salidas.set(claveSalida, (salidas.get(claveSalida) ?? 0) + 1);
    const conectorEntrada = dataConnectors(destino).find((item) => item.name === conector && acceptsInput(item))
      ?? dataConnectors(destino).find(acceptsInput);
    if (conectorEntrada) {
      const claveEntrada = `${conexion.target}|${conectorEntrada.name}`;
      entradas.set(claveEntrada, (entradas.get(claveEntrada) ?? 0) + 1);
    }
  }

  for (const [clave, cantidad] of salidas) {
    const [nodo, conector] = clave.split("|") as [string, string];
    const definicion = await definicionDe(tipos.get(nodo)!);
    const maximo = definicion?.connectors.find((item) => item.name === conector)?.maxOutput;
    if (maximo !== undefined && maximo >= 0 && cantidad > maximo && !SIN_LIMITE.has(tipos.get(nodo)!.toLowerCase())) {
      errores.push(`'${nodo}' (${tipos.get(nodo)}) admite ${maximo} conexion(es) de salida por '${conector}' y tiene ${cantidad}`);
    }
  }
  for (const [clave, cantidad] of entradas) {
    const [nodo, conector] = clave.split("|") as [string, string];
    const definicion = await definicionDe(tipos.get(nodo)!);
    const maximo = definicion?.connectors.find((item) => item.name === conector)?.maxInput;
    if (maximo !== undefined && maximo >= 0 && cantidad > maximo && !SIN_LIMITE.has(tipos.get(nodo)!.toLowerCase())) {
      errores.push(`'${nodo}' (${tipos.get(nodo)}) admite ${maximo} conexion(es) de entrada por '${conector}' y tiene ${cantidad}`);
    }
  }
  return errores;
}
