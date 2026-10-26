import type { Bridge, Contexto, Definiciones, JobSpec, Paso } from "./scenario-types";
import { planJobAssembly } from "./job-plan";
import { reintentar, errorDe, transitorioDeStudio } from "./studio-retry";
import {
  anadirNodo,
  parametrosDe,
  pendientesVacios,
  ponerSchemaInicial,
} from "./job-nodes";
import { aplicarPendientes, conectarNodos } from "./job-wiring";

/**
 * Montaje de un job completo: limpiar, crear, nodos, conexiones y
 * configuracion posterior.
 */

/**
 * Crea los contextos (entornos) del job y sus variables.
 *
 * Se hace con la API de Studio: el job se guarda con sus entornos, tal y como
 * los dejaria el IDE. El entorno por defecto ya existe, asi que solo se le
 * anaden las variables.
 */
export async function crearContextos(
  bridge: Bridge,
  job: string,
  contextos: Contexto[] | undefined,
): Promise<Paso> {
  for (const contexto of contextos ?? []) {
    if (contexto.nombre !== "Default") {
      const creado = await bridge.createJobContext({ job, name: contexto.nombre });
      if (!creado.ok) {
        return {
          ok: false,
          mensaje: `no se pudo crear el contexto '${contexto.nombre}': ${errorDe(creado)}`,
        };
      }
    }
    for (const variable of contexto.variables ?? []) {
      const puesta = await bridge.setJobContextParameter({
        job,
        context: contexto.nombre,
        name: variable.nombre,
        value: variable.valor,
        type: variable.tipo,
      });
      if (!puesta.ok) {
        return {
          ok: false,
          mensaje: `no se pudo poner la variable '${variable.nombre}' en '${contexto.nombre}': ${errorDe(puesta)}`,
        };
      }
    }
  }
  return { ok: true };
}

/**
 * Monta un job: lo borra, lo crea, anade los nodos con su configuracion y
 * los conecta.
 */
export async function montarJob(
  bridge: Bridge,
  spec: JobSpec,
  definiciones: Definiciones,
): Promise<Paso> {
  const jobPlan = planJobAssembly({ nodes: spec.nodos, connections: spec.conexiones }, definiciones);
  if (!jobPlan.ok) {
    return { ok: false, mensaje: jobPlan.error };
  }

  // 1. Job limpio.
  const borrado = await reintentar(
    () => bridge.deleteJob({ name: spec.job }),
    transitorioDeStudio,
  );
  if (!borrado.ok && !/no existe|not found|no se/i.test(errorDe(borrado))) {
    return { ok: false, mensaje: `no se pudo borrar: ${errorDe(borrado)}` };
  }

  const creado = await reintentar(
    () => bridge.createJob({ name: spec.job, replace: true }),
    transitorioDeStudio,
  );
  if (!creado.ok) {
    return { ok: false, mensaje: `no se pudo crear: ${errorDe(creado)}` };
  }

  // Los contextos (entornos) del job, con sus variables.
  const contextsOk = await crearContextos(bridge, spec.job, spec.contextos);
  if (!contextsOk.ok) return contextsOk;

  // El job tiene que estar abierto en el editor antes de anadir nodos. Studio
  // a veces contesta "No se pudo abrir el job ... en el editor" (le pasa
  // tambien con jobs del usuario): es transitorio y se reintenta.
  const abierto = await reintentar(
    () => bridge.openJob({ name: spec.job }),
    transitorioDeStudio,
  );
  if (!abierto.ok) {
    return { ok: false, mensaje: `no se pudo abrir el job: ${errorDe(abierto)}` };
  }

  // 2. Nodos, con sus parametros y su schema.
  const nombres = new Map<string, string>();
  const nodosPorAlias = new Map(
    spec.nodos.map((nodo, indice) => [nodo.nombre ?? `#${indice}`, [nodo, indice] as const]),
  );
  const pendientes = pendientesVacios();

  for (const alias of jobPlan.nodes) {
    const entrada = nodosPorAlias.get(alias);
    if (!entrada) continue;
    const [nodo, indiceNodo] = entrada;
    const nombrePlan = nodo.nombre ?? `#${indiceNodo}`;

    const anadido = await anadirNodo(bridge, spec.job, nodo, parametrosDe(nodo, nombres));
    if (!anadido.ok) return { ok: false, mensaje: anadido.mensaje };
    const uniqueName = anadido.uniqueName;

    if (nodo.nombre) nombres.set(nodo.nombre, uniqueName);

    const schema = await ponerSchemaInicial(bridge, spec.job, nodo, uniqueName, nombrePlan, pendientes);
    if (!schema.ok) return schema;

    // Las tablas y el mapa se aplican despues de conectar: al conectar,
    // Talend rehace las tablas del componente y se pierde lo que habia.
    if (nodo.tablas) {
      pendientes.tablas.push({ nombre: nombrePlan, uniqueName, tablas: nodo.tablas });
    }
    if (nodo.mapper) {
      pendientes.mappers.push({ nombre: nombrePlan, uniqueName, mapper: nodo.mapper });
    }
  }

  // 3. Conexiones y configuracion posterior.
  const cableado = await conectarNodos(bridge, spec.job, jobPlan, nombres);
  if (!cableado.ok) return cableado;

  return aplicarPendientes(bridge, spec.job, jobPlan, pendientes);
}
