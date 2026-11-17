import type { Bridge, Contexto, Definiciones, JobSpec, Paso } from "./scenario-types";
import { planJobAssembly } from "./job-plan";
import { reintentar, errorDe, transitorioDeStudio } from "./studio-retry";
import {
  anadirNodo,
  parametrosDe,
  pendientesVacios,
  tablasConRutas,
  ponerSchemaInicial,
} from "./job-nodes";
import { aplicarPendientes, conectarNodos } from "./job-wiring";
import { medir } from "./tiempos";

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
 * Si un fallo al borrar el job es esperable: el job todavia no existe.
 *
 * Solo eso. Un fallo cualquiera (Studio sin responder, un job abierto) no se
 * tolera: si se ignora, el job anterior se queda y el montaje sigue sobre el.
 */
export function borradoTolerable(mensaje: string): boolean {
  return /no existe|not found|no se encontr/i.test(mensaje);
}

/**
 * Nombres de los nodos que Studio ve en un job.
 *
 * `listNodes` devuelve la lista directamente (o bajo `nodes`, segun la
 * version del bridge); se aceptan las dos formas. Devuelve `undefined` si la
 * lista no se pudo leer: quien llama decide si eso es un fallo.
 */
export async function nodosVisibles(bridge: Bridge, job: string): Promise<string[] | undefined> {
  const listado = await bridge.listNodes({ job });
  if (!listado.ok) {
    return undefined;
  }
  const datos = listado.data as unknown;
  const crudos = Array.isArray(datos)
    ? datos
    : Array.isArray((datos as { nodes?: unknown } | undefined)?.nodes)
      ? ((datos as { nodes: unknown[] }).nodes)
      : [];
  return crudos.map((nodo) => {
    const valor = (nodo ?? {}) as Record<string, unknown>;
    if (typeof valor.uniqueName === "string" && valor.uniqueName) return valor.uniqueName;
    if (typeof valor.componentName === "string" && valor.componentName) return valor.componentName;
    return "nodo";
  });
}

/**
 * Deja el job recien creado vacio.
 *
 * Studio puede conservar el modelo del intento anterior si su editor no se
 * cerro al borrarlo: el job nuevo nace con los nodos viejos y el montaje
 * acaba mezclando los dos. Si aparece algun nodo, se borra el job (el borrado
 * publico cierra los editores) y se crea otra vez, una sola vez. Si sigue
 * con nodos, se falla con el detalle en vez de montar sobre basura.
 */
export async function asegurarJobVacio(bridge: Bridge, job: string): Promise<Paso> {
  const primera = await nodosVisibles(bridge, job);
  if (primera === undefined) {
    return { ok: false, mensaje: "no se pudieron listar los nodos del job recien creado" };
  }
  if (primera.length === 0) {
    return { ok: true };
  }

  const recreado = await medir("recrear job con nodos obsoletos", async () => {
    const borrado = await reintentar(() => bridge.deleteJob({ name: job }), transitorioDeStudio);
    if (!borrado.ok && !borradoTolerable(errorDe(borrado))) {
      return borrado;
    }
    const creado = await reintentar(() => bridge.createJob({ name: job, replace: true }), transitorioDeStudio);
    if (!creado.ok) {
      return creado;
    }
    return await reintentar(() => bridge.openJob({ name: job }), transitorioDeStudio);
  });
  if (!recreado.ok) {
    return {
      ok: false,
      mensaje: `el job '${job}' nacio con nodos del intento anterior (${primera.join(", ")}) y no se pudo recrear: ${errorDe(recreado)}`,
    };
  }

  const segunda = await nodosVisibles(bridge, job);
  if (segunda === undefined) {
    return { ok: false, mensaje: `no se pudieron listar los nodos de '${job}' tras recrearlo` };
  }
  if (segunda.length > 0) {
    return {
      ok: false,
      mensaje: `el job '${job}' conserva nodos del intento anterior (${segunda.join(", ")}) incluso tras recrearlo: Studio no cerro el editor del Job. Cierra el Job en Studio (o reinicia Studio) y repite el montaje.`,
    };
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
  const borrado = await medir("borrar job anterior", () =>
    reintentar(() => bridge.deleteJob({ name: spec.job }), transitorioDeStudio),
  );
  if (!borrado.ok && !borradoTolerable(errorDe(borrado))) {
    return { ok: false, mensaje: `no se pudo borrar: ${errorDe(borrado)}` };
  }

  const creado = await medir("crear job", () =>
    reintentar(() => bridge.createJob({ name: spec.job, replace: true }), transitorioDeStudio),
  );
  if (!creado.ok) {
    return { ok: false, mensaje: `no se pudo crear: ${errorDe(creado)}` };
  }

  // El job tiene que estar abierto en el editor antes de anadir nodos. Studio
  // a veces contesta "No se pudo abrir el job ... en el editor" (le pasa
  // tambien con jobs del usuario): es transitorio y se reintenta.
  // `createJob` ya lo deja abierto. Esta llamada espera a que el editor termine de
  // abrirse (~0,6 s medidos), y garantiza que es el job activo que el Run ejecutara.
  const abierto = await medir("abrir job", () =>
    reintentar(() => bridge.openJob({ name: spec.job }), transitorioDeStudio),
  );
  if (!abierto.ok) {
    return { ok: false, mensaje: `no se pudo abrir el job: ${errorDe(abierto)}` };
  }

  // El job nuevo tiene que estar vacio: si Studio reutilizo el modelo del
  // intento anterior, aqui se ve y se corrige antes de montar nada.
  const vacio = await medir("comprobar job vacio", () => asegurarJobVacio(bridge, spec.job));
  if (!vacio.ok) return vacio;

  // Los contextos (entornos) del job, con sus variables.
  const contextsOk = await medir("contextos", () => crearContextos(bridge, spec.job, spec.contextos));
  if (!contextsOk.ok) return contextsOk;

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

    const anadido = await medir(`anadir ${nombrePlan}`, () =>
      anadirNodo(bridge, spec.job, nodo, parametrosDe(nodo, nombres)),
    );
    if (!anadido.ok) return { ok: false, mensaje: anadido.mensaje };
    const uniqueName = anadido.uniqueName;

    if (nodo.nombre) nombres.set(nodo.nombre, uniqueName);

    const schema = await medir(`schema ${nombrePlan}`, () =>
      ponerSchemaInicial(bridge, spec.job, nodo, uniqueName, nombrePlan, pendientes),
    );
    if (!schema.ok) return schema;

    // Las tablas y el mapa se aplican despues de conectar: al conectar,
    // Talend rehace las tablas del componente y se pierde lo que habia.
    if (nodo.tablas) {
      pendientes.tablas.push({ nombre: nombrePlan, uniqueName, tablas: tablasConRutas(nodo.tablas) });
    }
    if (nodo.mapper) {
      pendientes.mappers.push({ nombre: nombrePlan, uniqueName, mapper: nodo.mapper });
    }
  }

  // 3. Conexiones y configuracion posterior.
  const cableado = await medir("conectar nodos", () => conectarNodos(bridge, spec.job, jobPlan, nombres));
  if (!cableado.ok) return cableado;

  return medir("configuracion posterior", () => aplicarPendientes(bridge, spec.job, jobPlan, pendientes));
}
