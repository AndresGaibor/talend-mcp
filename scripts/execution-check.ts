/**
 * Harness de ejecucion (L5): monta un job, lo ejecuta y comprueba que la
 * salida es la esperada.
 *
 *   bun run scripts/execution-check.ts                       # todas las pruebas
 *   bun run scripts/execution-check.ts archivos             # filtro por nombre
 *   bun run scripts/execution-check.ts --suite transformaciones
 *   bun run scripts/execution-check.ts --solo-fallidos       # reintenta los fallos del CSV anterior
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
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { consultar, preparar } from "./l5/postgres";
import { selectScenarios } from "./l5/scenario-selection";
import { planJobAssembly } from "./l5/job-plan";
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
  /**
   * SQL que se ejecuta en el Postgres de pruebas **antes** del job.
   *
   * Sirve para dejar la tabla como el escenario la necesita: el UPDATE y el
   * DELETE solo tienen sentido si ya hay filas.
   */
  prepara?: string[];
  /** Que se espera al ejecutar. */
  espera?: {
    /** Lineas exactas de la salida del job, o solo cuantas lineas. */
    lineas?: string[] | number;
    /** Lineas que tienen que aparecer. */
    contiene?: string[];
    /** Fichero que el job escribe. */
    fichero?: { ruta: string; lineas?: number | string[]; contiene?: string[] };
    /** Los contextos que tiene que tener el job, con sus variables. */
    contextos?: Array<{
      nombre: string;
      variables: Array<{ nombre: string; valor: string }>;
    }>;
    /**
     * Consulta a la base de datos de pruebas despues de ejecutar.
     *
     * Es la forma de comprobar lo que el job escribe en una base de datos:
     * el `tDBOutput` no saca filas, asi que no hay nada que mirar en la salida.
     */
    /** El job termina en error a proposito (un trigger de error, por ejemplo). */
    error_esperado?: boolean;
    consulta?: { sql: string; valor: string | number };
  };
};

const args = process.argv.slice(2);
const salidaCsv = "testdata/resultados-l5.csv";
const ficheroEscenarios = "tests/fixtures/talend/escenarios-l5.json";
const carpetaTestdata = resolve(process.cwd(), "testdata");

function argumento(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  const inline = args.find((arg) => arg.startsWith(prefijo));
  if (inline) return inline.slice(prefijo.length);
  const indice = args.indexOf(`--${nombre}`);
  return indice >= 0 ? args[indice + 1] : undefined;
}

const suite = argumento("suite")?.toLowerCase();
const soloFallidos = args.includes("--solo-fallidos");
const referenciaGit = argumento("desde");
const filtro = args.find(
  (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--suite" && args[index - 1] !== "--desde",
);

const suitesValidas = new Set([
  "humo", "archivos", "transformaciones", "bd", "control", "contextos", "orquestacion", "codigo", "otros",
]);

function nombresFallidosAnteriores(): Set<string> {
  if (!existsSync(salidaCsv)) {
    throw new Error(`No existe el informe anterior ${salidaCsv}; ejecuta primero una suite completa.`);
  }
  return new Set(
    readFileSync(salidaCsv, "utf8")
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .filter((linea) => {
        const campos = linea.split(",");
        return campos[2] !== "si" || campos[3] !== "si";
      })
      .map((linea) => linea.split(",", 1)[0] ?? ""),
  );
}

function nombresCambiadosDesde(referencia: string): Set<string> {
  let salida: string;
  try {
    salida = execFileSync("git", ["show", `${referencia}:${ficheroEscenarios}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`No se pudo leer ${ficheroEscenarios} en '${referencia}': ${error}`);
  }
  const anterior = JSON.parse(salida.replace(/^\uFEFF/, "")) as Escenario[] | { escenarios: Escenario[] };
  const escenariosAnteriores = Array.isArray(anterior) ? anterior : anterior.escenarios;
  const versionAnterior = new Map(escenariosAnteriores.map((escenario) => [escenario.nombre, JSON.stringify(escenario)]));
  const actual = JSON.parse(readFileSync(ficheroEscenarios, "utf8").replace(/^\uFEFF/, "")) as
    | Escenario[]
    | { escenarios: Escenario[] };
  const escenariosActuales = Array.isArray(actual) ? actual : actual.escenarios;
  return new Set(
    escenariosActuales
      .filter((escenario) => versionAnterior.get(escenario.nombre) !== JSON.stringify(escenario))
      .map((escenario) => escenario.nombre),
  );
}

/** Sustituye `@TESTDATA@` por la ruta absoluta de los datos de prueba. */
function conRutas(valor: string): string {
  return valor.replace(/@TESTDATA@/g, carpetaTestdata.replace(/\\/g, "/"));
}

function errorDe(respuesta: { error?: { message?: string }; rawText?: string }): string {
  return respuesta.error?.message ?? respuesta.rawText?.slice(0, 300) ?? "error desconocido";
}

/** Definiciones de los componentes, para saber sus conectores. */
let definiciones = new Map<string, Awaited<ReturnType<DefinitionIndexRepository["load"]>>["components"][number]>();

async function main(): Promise<void> {
  if (suite && !suitesValidas.has(suite)) {
    throw new Error(`Suite desconocida '${suite}'. Opciones: ${[...suitesValidas].join(", ")}`);
  }
  if (!existsSync(ficheroEscenarios)) {
    console.error(`No esta el fichero de escenarios: ${ficheroEscenarios}`);
    process.exit(1);
  }
  const contenido = JSON.parse(
    readFileSync(ficheroEscenarios, "utf8").replace(/^\uFEFF/, ""),
  ) as Escenario[] | { escenarios: Escenario[] };
  const escenarios = Array.isArray(contenido) ? contenido : contenido.escenarios;
  const fallidosAnteriores = soloFallidos ? nombresFallidosAnteriores() : undefined;
  const cambiadosDesde = referenciaGit ? nombresCambiadosDesde(referenciaGit) : undefined;
  const escenariosSeleccionados = selectScenarios(escenarios, {
    nameFilter: filtro,
    suite,
    failedNames: fallidosAnteriores,
    changedNames: cambiadosDesde,
  });
  if (escenariosSeleccionados.length === 0) {
    console.log("No hay escenarios que coincidan con los filtros.");
    return;
  }
  const bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });

  // Las definiciones de los componentes: de ellas sale el conector por el que
  // se conecta cada uno.
  const indice = await new DefinitionIndexRepository().load();
  definiciones = new Map(indice.components.map((componente) => [componente.name, componente]));

  const cabeceraCsv = "escenario,job,ejecuta_ok,salida_correcta,detalle";
  const resultadosPrevios = new Map<string, string>();
  if (existsSync(salidaCsv)) {
    for (const linea of readFileSync(salidaCsv, "utf8").split(/\r?\n/).slice(1)) {
      if (linea.trim()) resultadosPrevios.set(linea.split(",", 1)[0] ?? "", linea);
    }
  }
  const resultadosActuales = new Map<string, string>();
  let bien = 0;
  let total = 0;

  for (const escenario of escenariosSeleccionados) {
    total++;
    const detalle = await ejecutar(bridge, escenario);
    const correcto = detalle.ejecutaOk && detalle.salidaCorrecta;
    if (correcto) bien++;
    console.log(
      `${correcto ? "OK   " : "FALLA"} ${escenario.nombre}` +
        (detalle.mensaje ? `: ${detalle.mensaje}` : ""),
    );
    resultadosActuales.set(
      escenario.nombre,
      [
        escenario.nombre,
        escenario.job,
        detalle.ejecutaOk ? "si" : "no",
        detalle.salidaCorrecta ? "si" : "no",
        `"${(detalle.mensaje ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    );
  }

  for (const [nombre, linea] of resultadosActuales) resultadosPrevios.set(nombre, linea);
  const lineas = [cabeceraCsv, ...resultadosPrevios.values()];
  writeFileSync(salidaCsv, `${lineas.join("\n")}\n`, "utf8");
  console.log(`\n${bien} de ${total} escenarios correctos. Informe en ${salidaCsv}`);
  if (bien !== total) process.exitCode = 1;
}

type Resultado = { ejecutaOk: boolean; salidaCorrecta: boolean; mensaje?: string };

/**
 * Los fallos de Studio que se pasan solos.
 *
 * Esta ocupado compilando, hay un modal abierto o el editor del job no
 * responde a la primera: el bridge avisa, se espera y se repite la accion.
 * El aviso "No se pudo abrir el job ... en el editor" aparece tambien con
 * jobs del usuario, asi que no es un problema del escenario.
 */
function transitorioDeStudio(mensaje: string): boolean {
  return (
    mensaje.includes("No se pudo abrir el job") ||
    mensaje.includes("hilo de la interfaz") ||
    mensaje.includes("ocupado")
  );
}

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
  const abierto = await reintentar(
    () => bridge.openJob({ name: job }),
    transitorioDeStudio,
  );
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
 * Los mensajes que da el bridge mientras el build sigue en marcha.
 *
 * Sin `classpath.jar` el job no ha empezado a empaquetarse, y sin la clase
 * principal esta a medio compilar. En los dos casos hay que esperar y
 * reintentar: no es un fallo del job.
 */
function compilando(error: string): boolean {
  return (
    error.includes("no esta compilado") ||
    error.includes("No se encontro la clase principal")
  );
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
  // Se espera un poco antes del primer intento: ejecutar el job abre su
  // `classpath.jar`, y si Studio esta justo reemplazandolo el build falla con
  // "El proceso no tiene acceso al archivo" y la carpeta se queda sin codigo
  // (INTERNALS 55). Unos segundos de margen evitan casi siempre el choque.
  await new Promise((resolve) => setTimeout(resolve, 12_000));
  for (let intento = 0; intento < intentos; intento++) {
    const ejecutado = await bridge.executeJob({ name: job, timeoutMs: 120_000 });
    const cuerpo = (ejecutado.data ?? {}) as {
      result?: { error?: string };
      error?: string;
    };
    const error = cuerpo.result?.error ?? cuerpo.error ?? "";
    if (!compilando(error)) {
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

  if (escenario.prepara && escenario.prepara.length > 0) {
    const preparado = await preparar(escenario.prepara);
    if (!preparado.ok) {
      return { ejecutaOk: false, salidaCorrecta: false, mensaje: preparado.mensaje };
    }
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
  const jobPlan = planJobAssembly({ nodes: spec.nodos, connections: spec.conexiones }, definiciones);
  if (!jobPlan.ok) {
    return { ok: false, mensaje: jobPlan.error };
  }
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
  if (!contextsOk.ok) {
    return contextsOk;
  }

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
  const tablasPorNodo: Array<{ nombre: string; uniqueName: string; tablas: NonNullable<Nodo["tablas"]> }> = [];
  const esquemasDespues: Array<{
    uniqueName: string;
    nombre: string;
    schema: unknown[];
    columns?: Nodo["columnas"];
    values?: Nodo["values"];
  }> = [];
  const mappersPorNodo: Array<{ nombre: string; uniqueName: string; mapper: NonNullable<Nodo["mapper"]> }> = [];
  for (const alias of jobPlan.nodes) {
  const entrada = nodosPorAlias.get(alias);
  if (!entrada) continue;
  const [nodo, indiceNodo] = entrada;
  const nombrePlan = nodo.nombre ?? `#${indiceNodo}`;
  const parameters = nodo.parameters
    ? Object.fromEntries(
        Object.entries(nodo.parameters).map(([clave, valor]) => [
          clave,
          {
            // "@uniqueName:<nodo>" es el nombre unico de otro nodo del job
            // (el tPostgresqlInput necesita el de su conexion).
            value: Array.isArray(valor.value)
              ? valor.value
              : conRutas(valor.value).replace(
                  /@uniqueName:([A-Za-z0-9_]+)/g,
                  (_, nombre: string) => nombres.get(nombre) ?? `@uniqueName:${nombre}`,
                ),
            literal: valor.literal,
          },
        ]),
      )
    : undefined;
  let anadido = await bridge.addNode({
    type: nodo.type,
    job: spec.job,
    parameters,
  });
  let uniqueName = "";
  // Dos fallos transitorios de Studio: contesta `ok` sin el nodo (esta
  // terminando un build) o no consigue abrir el job en el editor. En los dos
  // casos se reabre el job y se reintenta antes de dar el escenario por
  // perdido. La espera crece, porque el fallo tipico es que Studio todavia
  // esta cerrando el job anterior.
  for (let intento = 0; intento < 10; intento++) {
    if (anadido.ok) {
      // El bridge envuelve la respuesta en `result`.
      const cuerpo = (anadido.data ?? {}) as {
        uniqueName?: string;
        result?: { uniqueName?: string };
      };
      uniqueName = String(cuerpo.uniqueName ?? cuerpo.result?.uniqueName ?? "");
      if (uniqueName) break;
    } else if (!transitorioDeStudio(errorDe(anadido))) {
      return {
        ok: false,
        mensaje: `no se pudo anadir ${nodo.type}: ${errorDe(anadido)}`,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await bridge.openJob({ name: spec.job });
    anadido = await bridge.addNode({
      type: nodo.type,
      job: spec.job,
      parameters,
    });
  }
  if (!uniqueName) {
    return {
      ok: false,
      mensaje: `el bridge no devolvio el nombre del nodo ${nodo.type}: ${anadido.rawText?.slice(0, 200) ?? ""}`,
    };
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
      if (nodo.schemaDespuesDeConectar) {
        // Los nodos con filas tambien se reponen despues de conectar: al
        // conectar, el esquema del destino se propaga hacia atras y el
        // origen se queda con las columnas del destino.
        esquemasDespues.push({
          uniqueName,
          nombre: nombrePlan,
          schema: [],
          columns: nodo.columnas ?? [],
          values: nodo.values,
        });
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
        esquemasDespues.push({ uniqueName, nombre: nombrePlan, schema });
      }
    }
  }
  if (nodo.tablas) {
    // Las tablas se ponen DESPUES de conectar: al conectar, Talend rehace
    // las tablas del componente y se pierde lo que se habia puesto antes
    // (es lo que pasa con el tMap y con el tAggregateRow).
    tablasPorNodo.push({ nombre: nombrePlan, uniqueName, tablas: nodo.tablas });
  }
  if (nodo.mapper) {
    // El modelo del tMap tambien va despues de conectar: necesita las
    // columnas de la conexion de entrada para evaluar las expresiones.
    mappersPorNodo.push({ nombre: nombrePlan, uniqueName, mapper: nodo.mapper });
  }
}
// 3. El runner traduce los alias del plan a los nombres unicos generados por Studio.
for (const conexion of jobPlan.connections) {
  const origen = nombres.get(conexion.source);
  const destino = nombres.get(conexion.target);
  if (!origen || !destino) {
    return { ok: false, mensaje: `conexion sin nodos: ${conexion.source} -> ${conexion.target}` };
  }
  const conectada = await bridge.connectNodes({
    job: spec.job,
    source: origen,
    target: destino,
    type: conexion.type,
  });
  if (!conectada.ok) {
    return {
  ok: false,
      mensaje: `no se pudo conectar ${conexion.source} -> ${conexion.target}: ${errorDe(conectada)}`,
    };
  }
}
// 3. Tablas: despues de conectar, que es cuando el componente ya sabe
// que columnas de entrada tiene. Y tambien el schema de los componentes que
// lo piden (el tAggregateRow pierde la tabla de salida al conectar).
//
// El orden importa: al conectar, Talend propaga el esquema del destino hacia
// atras, asi que el origen se queda con las columnas del destino. Por eso
// los esquemas "despues" de los nodos que son origen de alguna conexion se
// ponen los ultimos: son los que se han quedado descolocados.
const ordenSchemas = new Map(jobPlan.afterConnect.schemas.map((nombre, indice) => [nombre, indice]));
const ordenEsquemas = [...esquemasDespues].sort(
  (a, b) => (ordenSchemas.get(a.nombre) ?? Number.MAX_SAFE_INTEGER) - (ordenSchemas.get(b.nombre) ?? Number.MAX_SAFE_INTEGER),
);
for (const pendiente of ordenEsquemas) {
    if (pendiente.values) {
      const conDatos = await bridge.setNodeSchema({
        job: spec.job,
        uniqueName: pendiente.uniqueName,
        columns: pendiente.columns ?? [],
        values: pendiente.values,
      });
      if (!conDatos.ok) {
        return {
  ok: false,
          mensaje: `no se pudieron reponer los datos: ${errorDe(conDatos)}`,
        };
      }
      continue;
    }
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
const tablasPorNombre = new Map(tablasPorNodo.map((pendiente) => [pendiente.nombre, pendiente]));
for (const nombre of jobPlan.afterConnect.tables) {
  const pendiente = tablasPorNombre.get(nombre);
  if (!pendiente) continue;
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
// El modelo del tMap: las tablas de entrada, las de salida (con las
// expresiones de cada columna) y las variables.
const mappersPorNombre = new Map(mappersPorNodo.map((pendiente) => [pendiente.nombre, pendiente]));
for (const nombre of jobPlan.afterConnect.mappers) {
  const pendiente = mappersPorNombre.get(nombre);
  if (!pendiente) continue;
  const conMapper = await bridge.configureNode({
    job: spec.job,
    uniqueName: pendiente.uniqueName,
    mapper: pendiente.mapper as unknown as Record<string, unknown>,
  });
  if (!conMapper.ok) {
    return {
      ok: false,
      mensaje: `no se pudo poner el modelo del tMap: ${errorDe(conMapper)}`,
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
    if (!compilando(error)) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    ejecutado = await bridge.executeJob({
      name: escenario.job,
      context: escenario.contexto,
      timeoutMs: 180_000,
    });
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
    // Un job puede terminar en error a proposito: lo que importa es que el
    // trigger de error se ejecuto (su salida se comprueba mas abajo).
    if (!escenario.espera?.error_esperado) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `salida con codigo ${cuerpo.exitCode}: ${lineas.slice(0, 3).join(" | ")}`,
      };
    }
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

  if (espera.lineas !== undefined) {
    if (typeof espera.lineas === "number") {
      // Solo el numero de lineas.
      if (lineas.length !== espera.lineas) {
        fallos.push(`salieron ${lineas.length} lineas y se esperaban ${espera.lineas}`);
      }
    } else {
      const mismo =
        espera.lineas.length === lineas.length &&
        espera.lineas.every((linea, indice) => linea === lineas[indice]);
      if (!mismo) {
        fallos.push(
          `las lineas no son las esperadas: se esperaba ${JSON.stringify(espera.lineas)} y salio ${JSON.stringify(lineas.slice(0, 6))}`,
        );
      }
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
      if (Array.isArray(espera.fichero.lineas)) {
        // Las lineas exactas, en orden: es la unica forma de comprobar el
        // orden en que escriben varios subjobs (un tPrejob y un tPostjob).
        const esperadas = espera.fichero.lineas;
        const mismo =
          esperadas.length === contenido.length &&
          esperadas.every((linea, indice) => linea === contenido[indice]);
        if (!mismo) {
          fallos.push(
            `el fichero no tiene las lineas esperadas: se esperaba ${JSON.stringify(esperadas)} y salio ${JSON.stringify(contenido.slice(0, 8))}`,
          );
        }
      } else if (espera.fichero.lineas !== undefined && contenido.length !== espera.fichero.lineas) {
        fallos.push(`el fichero tiene ${contenido.length} lineas y se esperaban ${espera.fichero.lineas}`);
      }
      for (const texto of espera.fichero.contiene ?? []) {
        if (!contenido.some((linea) => linea.includes(texto))) {
          fallos.push(`el fichero no contiene '${texto}'`);
        }
      }
    }
  }

  if (espera.consulta) {
    // Lo que el job escribe en la base de datos: se consulta despues de
    // ejecutar (el `tDBOutput` no saca filas, asi que no hay nada en la salida).
    const valor = await consultar(espera.consulta.sql);
    if (valor === null) {
      fallos.push(`la consulta fallo: ${espera.consulta.sql}`);
    } else if (String(valor) !== String(espera.consulta.valor)) {
      fallos.push(
        `la consulta devolvio '${valor}' y se esperaba '${espera.consulta.valor}'`,
      );
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
