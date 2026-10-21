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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";

type Columna = { name: string; type: string };

type Nodo = {
  type: string;
  /** Nombre con el que se le conoce en las conexiones. */
  nombre?: string;
  parameters?: Record<string, { value: string; literal?: boolean }>;
  /** Columnas del nodo. */
  columnas?: Columna[];
  /** Filas del `tFixedFlowInput`. */
  values?: string[][];
  /** Tablas del componente (UNIQUE_KEY, GROUPBYS, CRITERIA...). */
  tablas?: Record<string, { columns?: string[]; rows: Array<string[] | Record<string, string>> }>;
};

type Escenario = {
  nombre: string;
  /** Nombre del job de pruebas en el proyecto de Studio. */
  job: string;
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

async function main(): Promise<void> {
  if (!existsSync(ficheroEscenarios)) {
    console.error(`No esta el fichero de escenarios: ${ficheroEscenarios}`);
    process.exit(1);
  }
  const contenido = JSON.parse(readFileSync(ficheroEscenarios, "utf8")) as
    | Escenario[]
    | { escenarios: Escenario[] };
  const escenarios = Array.isArray(contenido) ? contenido : contenido.escenarios;
  const bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });

  const lineas = ["escenario,job,ejecuta_ok,salida_correcta,detalle"];
  let bien = 0;
  let total = 0;

  for (const escenario of escenarios) {
    if (filtro && !escenario.nombre.toLowerCase().includes(filtro.toLowerCase())) continue;
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

async function ejecutar(
  bridge: Awaited<ReturnType<typeof createBridgeClient>>,
  escenario: Escenario,
): Promise<Resultado> {
  // 1. Job limpio.
  const borrado = await bridge.deleteJob({ name: escenario.job });
  if (!borrado.ok && !/no existe|not found|no se/i.test(errorDe(borrado))) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: `no se pudo borrar: ${errorDe(borrado)}` };
  }
  const creado = await bridge.createJob({ name: escenario.job, replace: true });
  if (!creado.ok) {
    return { ejecutaOk: false, salidaCorrecta: false, mensaje: `no se pudo crear: ${errorDe(creado)}` };
  }

  // 2. Nodos, con sus parametros, su schema y sus tablas.
  const nombres = new Map<string, string>();
  for (const nodo of escenario.nodos) {
    const parameters = nodo.parameters
      ? Object.fromEntries(
          Object.entries(nodo.parameters).map(([clave, valor]) => [
            clave,
            { value: conRutas(valor.value), literal: valor.literal },
          ]),
        )
      : undefined;

    const anadido = await bridge.addNode({
      type: nodo.type,
      job: escenario.job,
      parameters,
    });
    if (!anadido.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `no se pudo anadir ${nodo.type}: ${errorDe(anadido)}`,
      };
    }
    const uniqueName = String((anadido.data as { uniqueName?: string })?.uniqueName ?? "");
    if (nodo.nombre) nombres.set(nodo.nombre, uniqueName);

    if (nodo.columnas) {
      if (nodo.values) {
        // El `tFixedFlowInput` lleva las filas en su tabla: se ponen con el
        // schema, que es como lo hace el IDE.
        const conDatos = await bridge.setNodeSchema({
          job: escenario.job,
          uniqueName,
          columns: nodo.columnas,
          values: nodo.values,
        });
        if (!conDatos.ok) {
          return {
            ejecutaOk: false,
            salidaCorrecta: false,
            mensaje: `no se pudieron poner los datos a ${nodo.type}: ${errorDe(conDatos)}`,
          };
        }
      } else {
        const conSchema = await bridge.configureNode({
          job: escenario.job,
          uniqueName,
          schema: [{ connector: "FLOW", name: uniqueName, columns: nodo.columnas }],
          tables: nodo.tablas,
        });
        if (!conSchema.ok) {
          return {
            ejecutaOk: false,
            salidaCorrecta: false,
            mensaje: `no se pudo poner el schema de ${nodo.type}: ${errorDe(conSchema)}`,
          };
        }
      }
    } else if (nodo.tablas) {
      const conTablas = await bridge.configureNode({
        job: escenario.job,
        uniqueName,
        tables: nodo.tablas,
      });
      if (!conTablas.ok) {
        return {
          ejecutaOk: false,
          salidaCorrecta: false,
          mensaje: `no se pudieron poner las tablas de ${nodo.type}: ${errorDe(conTablas)}`,
        };
      }
    }
  }

  // 3. Conexiones.
  for (const conexion of escenario.conexiones) {
    const origen = nombres.get(conexion.origen);
    const destino = nombres.get(conexion.destino);
    if (!origen || !destino) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `conexion sin nodos: ${conexion.origen} -> ${conexion.destino}`,
      };
    }
    const conectada = await bridge.connectNodes({
      job: escenario.job,
      source: origen,
      target: destino,
      type: conexion.tipo ?? "FLOW",
    });
    if (!conectada.ok) {
      return {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: `no se pudo conectar ${conexion.origen} -> ${conexion.destino}: ${errorDe(conectada)}`,
      };
    }
  }

  // 4. Ejecucion.
  const ejecutado = await bridge.executeJob({ name: escenario.job, timeoutMs: 180_000 });
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

  await bridge.deleteJob({ name: escenario.job });

  return {
    ejecutaOk: true,
    salidaCorrecta: fallos.length === 0,
    mensaje: fallos.join("; ") || undefined,
  };
}

await main();
