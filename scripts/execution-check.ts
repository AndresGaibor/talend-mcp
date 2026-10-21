/**
 * Harness de ejecucion (L5): monta un job, lo ejecuta y comprueba que la
 * salida es la esperada.
 *
 *   bun run scripts/execution-check.ts             # todas las pruebas
 *   bun run scripts/execution-check.ts archivos     # solo las que cuyo nombre cuadra
 *
 * Cada escenario declara el job que hay que montar, como montarlo y **que se
 * espera**; la comprobacion se hace contra esa expectativa, no contra lo que
 * salio. El informe se guarda en `testdata/resultados-l5.csv`.
 *
 * Los escenarios estan en `tests/fixtures/talend/escenarios-l5.json`: se pueden
 * anadir sin tocar el codigo. En sus valores, `@TESTDATA@` se sustituye por la
 * carpeta de datos de prueba (las rutas tienen que ser absolutas: el job
 * corre en el workspace de Studio, no en esta carpeta).
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { DefinitionIndexRepository } from "../src/modules/component-definitions/infrastructure/definition-index.repository";
import {
  inputConnectorOf,
  outputConnectorOf,
} from "../src/modules/component-definitions/application/plan-required-parameters.use-case";

type Columna = { name: string; type: string };

type Nodo = {
  type: string;
  /** Nombre con el que se le conoce en las conexiones. */
  nombre?: string;
  parameters?: Record<string, { value: string; literal?: boolean }>;
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
};

type Escenario = {
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
  contextos?: Array<{
    nombre: string;
    variables?: Array<{ nombre: string; valor: string; tipo?: string }>;
  }>;
  /** Contexto con el que se ejecuta el job (por defecto, el de Studio). */
  contexto?: string;
  /**
   * Jobs auxiliares (el hijo de un `tRunJob`, por ejemplo). Se montan antes
   * del job principal.
   */
  jobs?: Array<{
    job: string;
    nodos: Nodo[];
    conexiones: Array<{ origen: string; destino: string; tipo?: string }>;
  }>;
  nodos: Nodo[];
  conexiones: Array<{ origen: string; destino: string; tipo?: string }>;
  /** Que se espera al ejecutar. */
  espera?: {
    /** Lineas exactas de la salida del job. */
    lineas?: string[];
    /** Lineas que tienen que aparecer. */
    contiene?: string[];
    /** Fichero que el job escribe. */
    fichero?: { ruta: string; lineas?: number; contiene?: string[] };
    /** Los contextos que tiene que tener el job, con sus variables. */
    contextos?: Array<{
      nombre: string;
      variables: Array<{ nombre: string; valor: string }>;
    }>;
  };
};

const args = process.argv.slice(2);
const filtro = args.find((arg) => !arg.startsWith("--"));
const salidaCsv = "testdata/resultados-l5.csv";
const ficheroEscenarios = "tests/fixtures/talend/escenarios-l5.json";
const carpetaTestdata = resolve(process.cwd(), "testdata");

/** Sustituye `@TESTDATA@` por la ruta absoluta de los datos de prueba. */
function conRutas(valor: string): string {
  return valor.replace(/@TESTDATA@/g, carpetaTestdata.replace(/\\/g, "/"));
}

function errorDe(respuesta: { error?: { message?: string }; rawText?: string }): string {
  return respuesta.error?.message ?? respuesta.rawText?.slice(0, 300) ?? "error desconocido";
}

/** El tipo de componente de un nodo del escenario, por su nombre. */
function tipoDeNodo(nodos: Nodo[], nombre: string): string {
  return nodos.find((nodo) => nodo.nombre === nombre)?.type ?? "";
}

/**
 * El conector por el que sale un componente.
 *
 * Se saca de su definicion en el XML de Studio: el `tUniqRow` no saca sus
 * filas por el conector principal, sino por "UNIQUE" (y "DUPLICATE" para las
 * repetidas). Conectar por "FLOW" no da error: el job compila y no sale
 * ninguna fila.
 */
function conectorDeSalida(tipo: string): string {
  const definicion = definiciones.get(tipo);
  return definicion ? outputConnectorOf(definicion) : "FLOW";
}

/** Definiciones de los componentes, para saber sus conectores. */
let definiciones = new Map<string, Awaited<ReturnType<DefinitionIndexRepository["load"]>>["components"][number]>();

async function main(): Promise<void> {
  if (!existsSync(ficheroEscenarios)) {
    console.error(`No esta el fichero de escenarios: ${ficheroEscenarios}`);
    process.exit(1);
  }
  const contenido = JSON.parse(
    readFileSync(ficheroEscenarios, "utf8").replace(/^\uFEFF/, ""),
  ) as Escenario[] | { escenarios: Escenario[] };
  const escenarios = Array.isArray(contenido) ? contenido : contenido.escenarios;
  const bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });

  // Las definiciones de los componentes: de ellas sale el conector por el que
  // se conecta cada uno.
  const indice = await new DefinitionIndexRepository().load();
  definiciones = new Map(indice.components.map((componente) => [componente.name, componente]));

  const lineas = ["escenario,job,ejecuta_ok,salida_correcta,detalle"];
  let bien = 0;
  let total = 0;

  for (const escenario of escenarios) {
    if (filtro && !escenario.nombre.toLowerCase().includes(filtro.toLowerCase())) continue;
    if (escenario.pendiente) {
      console.log(`PENDIENTE ${escenario.nombre}: ${escenario.pendiente}`);
      continue;
    }
    total++;
    const detalle = await ejecutar(bridge, escenario);
    const correcto = detalle.ejecutaOk && detalle.salidaCorrecta;
    if (correcto) bien++;
    console.log(
      `${correcto ? "OK   " : "FALLA"} ${escenario.nombre}` +
        (detalle.mensaje ? `: ${detalle.mensaje}` : ""),
    );
    lineas.push(
      [
        escenario.nombre,
        escenario.job,
        detalle.ejecutaOk ? "si" : "no",
        detalle.salidaCorrecta ? "si" : "no",
        `"${(detalle.mensaje ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    );
  }

  writeFileSync(salidaCsv, `${lineas.join("\n")}\n`, "utf8");
  console.log(`\n${bien} de ${total} escenarios correctos. Informe en ${salidaCsv}`);
  if (bien !== total) process.exitCode = 1;
}

type Resultado = { ejecutaOk: boolean; salidaCorrecta: boolean; mensaje?: string };

/**
 * Repite una llamada mientrasStudio este ocupado.
 *
 * Studio esta ocupado cuando esta compilando o cuando hay un modal abierto:
 * el bridge avisa y la accion se descarta. Se espera y se vuelve a intentar.
 */
async function reintentar<T extends { ok: boolean; error?: { message?: string } }>(
  accion: () => Promise<T>,
  interesa: (mensaje: string) => boolean,
  intentos = 12,
): Promise<T> {
  let ultima = await accion();
  for (let intento = 0; intento < intentos && !ultima.ok; intento++) {
    const mensaje = ultima.error?.message ?? "";
    if (!interesa(mensaje)) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    ultima = await accion();
  }
  return ultima;
}

/**
 * Genera y compila el job con el Run de Studio.
 *
 * Es el paso que produce el `target/classpath.jar` que necesita la ejecucion
 * para releer la salida del job. Se abre el job en el editor (para que sea el
 * activo) y se lanza su Run: Studio genera el codigo, lo compila y lo
 * ejecuta; la launch config se crea sola si no existe.
 *
 * No se espera a que termine: el Run es asincrono y el tracker de Studio no
 * ve la terminacion. Lo que hace falta es que el build termine, y eso se
 * espera probando la ejecucion.
 */
async function compilarEnStudio(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  job: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const abierto = await bridge.openJob({ name: job });
  if (!abierto.ok) {
    return { ok: false, mensaje: `no se pudo abrir el job: ${errorDe(abierto)}` };
  }
  const lanzado = await bridge.runActiveJob({
    dryRun: false,
    saveBefore: true,
    waitForTermination: false,
    timeoutMs: 30_000,
  });
  if (!lanzado.ok) {
    return { ok: false, mensaje: `no se pudo ejecutar en Studio: ${errorDe(lanzado)}` };
  }
  const datos = (lanzado.data ?? {}) as { error?: { message?: string }; launched?: boolean };
  if (datos.error) {
    return {
      ok: false,
      mensaje: `el Run de Studio fallo: ${datos.error.message ?? JSON.stringify(datos.error)}`,
    };
  }
  if (!datos.launched) {
    return { ok: false, mensaje: "Studio no lanzo el job" };
  }
  return { ok: true };
}

/**
 * Espera a que un job este compilado.
 *
 * El Run de Studio es asincrono: lanza el build y sigue. La ejecucion solo
 * funciona cuando el build ha terminado, asi que se reintenta.
 */
async function esperarCompilado(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  job: string,
  intentos = 30,
): Promise<{ ok: boolean; mensaje?: string }> {
  for (let intento = 0; intento < intentos; intento++) {
    const ejecutado = await bridge.executeJob({ name: job, timeoutMs: 120_000 });
    const cuerpo = (ejecutado.data ?? {}) as {
      result?: { error?: string };
      error?: string;
    };
    const error = cuerpo.result?.error ?? cuerpo.error ?? "";
    if (!error.includes("no esta compilado")) {
      return { ok: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { ok: false, mensaje: "el build no termino a tiempo" };
}

async function ejecutar(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  escenario: Escenario,
): Promise<Resultado> {
  // Los contextos del job los crea `montarJob`, al crear el job: sus variables
  // las puede usar el job (un tContextLoad las lleva al flujo).

  // Los jobs auxiliares (el hijo de un tRunJob) se montan antes que el
  // principal, y se compilan: un job padre necesita su hijo generado para
  // poder llamarlo.
  for (const auxiliar of escenario.jobs ?? []) {
    const montado = await montarJob(bridge, auxiliar);
    if (!montado.ok) {
      return { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje };
    }
    const compilado = await compilarEnStudio(bridge, auxiliar.job);
    if (!compilado.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `no se pudo compilar el job auxiliar '${auxiliar.job}': ${compilado.mensaje}`,
      };
    }
    // Y se espera a que este compilado: si no, el build del padre no lo
    // encuentra y falla.
    const listo = await esperarCompilado(bridge, auxiliar.job);
    if (!listo.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `el job auxiliar '${auxiliar.job}' no llego a compilarse: ${listo.mensaje}`,
      };
    }
  }

  const montado = await montarJob(bridge, escenario);
  if (!montado.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: montado.mensaje };
  }

/**
 * Monta un job: lo borra, lo crea, anade los nodos con su configuracion y
 * los conecta.
 */
/**
 * Crea los contextos (entornos) del job y sus variables.
 *
 * Se hace con la API de Studio: el job se guarda con sus entornos, tal y como
 * los dejaria el IDE. El entorno por defecto ya existe, asi que solo se le
 * anaden las variables.
 */
async function crearContextos(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  job: string,
  contextos: Escenario["contextos"],
): Promise<{ ok: boolean; mensaje?: string }> {
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

async function montarJob(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  spec: {
    job: string;
    nodos: Nodo[];
    conexiones: Escenario["conexiones"];
    contextos?: Escenario["contextos"];
  },
): Promise<{ ok: boolean; mensaje?: string }> {  // 1. Job limpio.
  const borrado = await reintentar(
    () => bridge.deleteJob({ name: spec.job }),
    (mensaje) => mensaje.includes("hilo de la interfaz") || mensaje.includes("ocupado"),
  );
  if (!borrado.ok && !/no existe|not found|no se/i.test(errorDe(borrado))) {
    return { ok: false, mensaje: `no se pudo borrar: ${errorDe(borrado)}` };
  }
  const creado = await reintentar(
    () => bridge.createJob({ name: spec.job, replace: true }),
    (mensaje) => mensaje.includes("hilo de la interfaz") || mensaje.includes("ocupado"),
  );
  if (!creado.ok) {
    return { ok: false, mensaje: `no se pudo crear: ${errorDe(creado)}` };
  }

  // Los contextos (entornos) del job, con sus variables.
  const contextsOk = await crearContextos(bridge, spec.job, spec.contextos);
  if (!contextsOk.ok) {
    return contextsOk;
  }

  // 2. Nodos, con sus parametros y su schema.
  const nombres = new Map<string, string>();
  const tablasPorNodo: Array<{ uniqueName: string; tablas: NonNullable<Nodo["tablas"]> }> = [];
  const esquemasDespues: Array<{ uniqueName: string; schema: unknown[] }> = [];
  for (const nodo of spec.nodos) {
  const parameters = nodo.parameters
    ? Object.fromEntries(
        Object.entries(nodo.parameters).map(([clave, valor]) => [
          clave,
          {
            // "@uniqueName:<nodo>" es el nombre unico de otro nodo del job
            // (el tPostgresqlInput necesita el de su conexion).
            value: conRutas(valor.value).replace(
              /@uniqueName:([A-Za-z0-9_]+)/g,
              (_, nombre: string) => nombres.get(nombre) ?? `@uniqueName:${nombre}`,
            ),
            literal: valor.literal,
          },
        ]),
      )
    : undefined;
  const anadido = await bridge.addNode({
    type: nodo.type,
    job: spec.job,
    parameters,
  });
  if (!anadido.ok) {
    return {
  ok: false,
      mensaje: `no se pudo anadir ${nodo.type}: ${errorDe(anadido)}`,
    };
  }
  // El bridge envuelve la respuesta en `result`.
  const cuerpo = (anadido.data ?? {}) as {
    uniqueName?: string;
    result?: { uniqueName?: string };
  };
  const uniqueName = String(cuerpo.uniqueName ?? cuerpo.result?.uniqueName ?? "");
  if (!uniqueName) {
    return { ok: false, mensaje: `el bridge no devolvio el nombre del nodo ${nodo.type}` };
  }
  if (nodo.nombre) nombres.set(nodo.nombre, uniqueName);
  if (nodo.columnas || nodo.columnasPorConector || nodo.esquemas) {
    if (nodo.values) {
      // El `tFixedFlowInput` lleva las filas en su tabla: se ponen con el
      // schema, que es como lo hace el IDE.
      const conDatos = await bridge.setNodeSchema({
        job: spec.job,
        uniqueName,
        columns: nodo.columnas ?? [],
        values: nodo.values,
      });
      if (!conDatos.ok) {
        return {
  ok: false,
          mensaje: `no se pudieron poner los datos a ${nodo.type}: ${errorDe(conDatos)}`,
        };
      }
    } else {
      // El schema va en su conector y, si el nodo tiene mas de un conector
      // de datos, tambien en los demas: el `tUniqRow` tiene el de salida en
      // el conector UNIQUE.
      const schema = nodo.esquemas
        ? nodo.esquemas.map((tabla) => ({
            connector: tabla.conector,
            // "@uniqueName" es el nombre unico del nodo.
            name: tabla.nombre === "@uniqueName" ? uniqueName : tabla.nombre,
            columns: tabla.columnas,
          }))
        : [
            ...(nodo.columnas
              ? [{ connector: "FLOW", name: uniqueName, columns: nodo.columnas }]
              : []),              ...Object.entries(nodo.columnasPorConector ?? {}).map(([connector, columnas]) => ({
              connector,
              name: uniqueName,
              columns: columnas,
            })),
          ];
      const conSchema = await bridge.configureNode({
        job: spec.job,
        uniqueName,
        schema,
      });
      if (!conSchema.ok) {
        return {
  ok: false,
          mensaje: `no se pudo poner el schema de ${nodo.type}: ${errorDe(conSchema)}`,
        };
      }
      if (nodo.schemaDespuesDeConectar) {
        esquemasDespues.push({ uniqueName, schema });
      }
    }
  }
  if (nodo.tablas) {
    // Las tablas se ponen DESPUES de conectar: al conectar, Talend rehace
    // las tablas del componente y se pierde lo que se habia puesto antes
    // (es lo que pasa con el tMap y con el tAggregateRow).
    tablasPorNodo.push({ uniqueName, tablas: nodo.tablas });
  }
}
// 3. Conexiones. El conector se saca de la definicion del componente de
// origen: el tUniqRow no saca sus filas por "FLOW", sino por "UNIQUE".
for (const conexion of spec.conexiones) {
  const origen = nombres.get(conexion.origen);
  const destino = nombres.get(conexion.destino);
  if (!origen || !destino) {
    return {
  ok: false,
      mensaje: `conexion sin nodos: ${conexion.origen} -> ${conexion.destino}`,
    };
  }
  const tipo = conexion.tipo ?? conectorDeSalida(tipoDeNodo(spec.nodos, conexion.origen));
  const conectada = await bridge.connectNodes({
    job: spec.job,
    source: origen,
    target: destino,
    type: tipo,
  });
  if (!conectada.ok) {
    return {
  ok: false,
      mensaje: `no se pudo conectar ${conexion.origen} -> ${conexion.destino}: ${errorDe(conectada)}`,
    };
  }
}
// 3. Tablas: despues de conectar, que es cuando el componente ya sabe
// que columnas de entrada tiene. Y tambien el schema de los componentes que
// lo piden (el tAggregateRow pierde la tabla de salida al conectar).
for (const pendiente of esquemasDespues) {
  const conSchema = await bridge.configureNode({
    job: spec.job,
    uniqueName: pendiente.uniqueName,
    schema: pendiente.schema as never,
  });
  if (!conSchema.ok) {
    return {
  ok: false,
      mensaje: `no se pudo poner el schema: ${errorDe(conSchema)}`,
    };
  }
}
for (const pendiente of tablasPorNodo) {
  const conTablas = await bridge.configureNode({
    job: spec.job,
    uniqueName: pendiente.uniqueName,
    tables: pendiente.tablas,
  });
  if (!conTablas.ok) {
    return {
  ok: false,
      mensaje: `no se pudieron poner las tablas: ${errorDe(conTablas)}`,
    };
  }
}
  return { ok: true };
}

  // 4. Ejecucion. Primero hay que generarlo y compilarlo: eso es lo que hace
  // el Run de Studio (y lo que deja el `target/classpath.jar` que necesita la
  // ejecucion para releer la salida). Despues se relanza para capturar lo que
  // imprime. El build tarda, asi que se reintenta hasta que el job este
  // compilado.
  const compilado = await compilarEnStudio(bridge, escenario.job);
  if (!compilado.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: compilado.mensaje };
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
    const cuerpo = ((ejecutado.data ?? {}) as { result?: { error?: string }; error?: string });
    const error = cuerpo.result?.error ?? cuerpo.error ?? "";
    if (!error.includes("no esta compilado")) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    ejecutado = await bridge.executeJob({ name: escenario.job, timeoutMs: 180_000 });
  }
  if (!ejecutado.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: `no se pudo ejecutar: ${errorDe(ejecutado)}` };
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
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: `error al ejecutar: ${cuerpo.error}` };
  }
  if (cuerpo.exitCode !== undefined && cuerpo.exitCode !== null && cuerpo.exitCode !== 0) {
    return {
      ejecutaOk: false,
      salidaCorrecta: false,
      mensaje: `salida con codigo ${cuerpo.exitCode}: ${lineas.slice(0, 3).join(" | ")}`,
    };
  }

  // 5. Comparacion con lo esperado.
  const espera = escenario.espera ?? {};
  const fallos: string[] = [];

  // Los contextos del job: se comprueba lo que se declaro.
  if (espera.contextos) {
    const listados = await bridge.jobContexts({ job: escenario.job });
    const contextos = (
      (listados.data?.result as { contexts?: Array<{ name: string; parameters?: Array<{ name: string; value: string }> }> })
        ?.contexts ?? []
    );
    for (const esperado of espera.contextos) {
      const contexto = contextos.find((item) => item.name === esperado.nombre);
      if (!contexto) {
        fallos.push(`el job no tiene el contexto '${esperado.nombre}'`);
        continue;
      }
      for (const variable of esperado.variables) {
        const encontrada = (contexto.parameters ?? []).find((item) => item.name === variable.nombre);
        if (!encontrada) {
          fallos.push(`el contexto '${esperado.nombre}' no tiene la variable '${variable.nombre}'`);
        } else if (encontrada.value !== variable.valor) {
          fallos.push(
            `en '${esperado.nombre}', '${variable.nombre}' vale '${encontrada.value}' y se esperaba '${variable.valor}'`,
          );
        }
      }
    }
  }

  if (espera.lineas) {
    const mismo =
      espera.lineas.length === lineas.length &&
      espera.lineas.every((linea, indice) => linea === lineas[indice]);
    if (!mismo) {
      fallos.push(
        `las lineas no son las esperadas: se esperaba ${JSON.stringify(espera.lineas)} y salio ${JSON.stringify(lineas.slice(0, 6))}`,
      );
    }
  }
  if (espera.contiene) {
    for (const texto of espera.contiene) {
      if (!lineas.some((linea) => linea.includes(texto))) {
        fallos.push(`no aparece '${texto}' en la salida`);
      }
    }
  }
  if (espera.fichero) {
    const ruta = conRutas(espera.fichero.ruta);
    if (!existsSync(ruta)) {
      fallos.push(`no se escribio el fichero ${ruta}`);
    } else {
      const contenido = readFileSync(ruta, "utf8").split("\n").filter((linea) => linea.length > 0);
      if (espera.fichero.lineas !== undefined && contenido.length !== espera.fichero.lineas) {
        fallos.push(`el fichero tiene ${contenido.length} lineas y se esperaban ${espera.fichero.lineas}`);
      }
      for (const texto of espera.fichero.contiene ?? []) {
        if (!contenido.some((linea) => linea.includes(texto))) {
          fallos.push(`el fichero no contiene '${texto}'`);
        }
      }
    }
  }

  if (process.env.L5_KEEP_JOBS !== "1") {
    await bridge.deleteJob({ name: escenario.job });
  }

  return {
    ejecutaOk: true,
    salidaCorrecta: fallos.length === 0,
    mensaje: fallos.join("; ") || undefined,
  };
}

await main();
