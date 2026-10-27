/**
 * Harness de ejecucion (L5): monta un job, lo ejecuta y comprueba que la
 * salida es la esperada.
 *
 *   bun run scripts/execution-check.ts                       # todas las pruebas
 *   bun run scripts/execution-check.ts archivos             # filtro por nombre
 *   bun run scripts/execution-check.ts --suite transformaciones
 *   bun run scripts/execution-check.ts --solo-fallidos       # reintenta los fallos del CSV anterior
 *   bun run scripts/execution-check.ts --todas               # repite tambien los que ya pasaron
 *   bun run scripts/execution-check.ts --sembrar             # marca como probados los que el informe ya da por buenos (sin Studio)
 *   bun run scripts/execution-check.ts --validar             # solo valida los fixtures (sin Studio)
 *
 * Cada escenario declara el job que hay que montar, como montarlo y **que se
 * espera**; la comprobacion se hace contra esa expectativa, no contra lo que
 * salio. El informe se guarda en `testdata/resultados-l5.csv`.
 *
 * Los escenarios estan en `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`:
 * se pueden anadir sin tocar el codigo y su diff no mezcla suites ni escenarios.
 * Antes de ejecutar se validan (nombre, job, nodos, suite) y el informe corta con
 * el archivo exacto si alguno esta mal. En sus valores, `@TESTDATA@` se sustituye
 * por la carpeta de datos de prueba (las rutas tienen que ser absolutas: el job
 * corre en el workspace de Studio, no en esta carpeta).
 *
 * El trabajo pesado vive en `scripts/l5/`: validacion, seleccion, montaje,
 * ejecucion, comparacion e informe. `--validar` no importa el bridge ni el
 * indice de componentes, asi que responde sin Studio.
 */

import { argumento, posicional } from "./l5/cli-args";
import { KNOWN_SUITES, selectScenarios } from "./l5/scenario-selection";
import { loadScenarioTree } from "./l5/scenario-files";
import { nombresCambiadosDesde } from "./l5/scenario-filters";
import { statSync } from "node:fs";
import {
  escribirResultados,
  filaResultado,
  leerResultados,
  nombresFallidos,
  nombresOk,
} from "./l5/scenario-report";
import { errorDe } from "./l5/studio-retry";
import {
  escribirCache,
  estaProbado,
  huellaDeDefiniciones,
  huellaDeEscenario,
  leerCache,
  sembrarDesdeInforme,
  tiposDeComponentes,
} from "./l5/scenario-cache";
import { margenDeMemoria } from "./l5/studio-memoria";
import type { Escenario, Resultado } from "./l5/scenario-types";

const args = process.argv.slice(2);
const salidaCsv = "testdata/resultados-l5.csv";
const cachePath = "testdata/cache-l5.json";

const suite = argumento(args, "suite")?.toLowerCase();
const soloFallidos = args.includes("--solo-fallidos");
const soloValidar = args.includes("--validar");
const todas = args.includes("--todas");
// Por defecto el job se ejecuta rapido (sin pasar por la consola de Run de Studio). Con
// --en-studio (o L5_EN_STUDIO=1) se lanza con el Run de Studio, para verlo alli.
const enStudio = args.includes("--en-studio") || process.env.L5_EN_STUDIO === "1";
const modoEjecucion = { enStudio };
// Con --reiniciar-studio (o L5_REINICIAR=1), al llegar al limite de memoria se reinicia Studio solo y la
// corrida sigue; sin la opcion se para y se pide reiniciarlo a mano.
const reiniciarStudioSiHaceFalta = args.includes("--reiniciar-studio") || process.env.L5_REINICIAR === "1";
const sembrar = args.includes("--sembrar");
const referenciaGit = argumento(args, "desde");
const filtro = posicional(args, ["--suite", "--desde"]);

const suitesValidas = new Set([...KNOWN_SUITES, "otros"]);

/**
 * Un aviso separado en su tipo y su nodo. Los de la vista Problemas llevan el nodo delante
 * (`tDBOutput_2: the schema's dbType not correct...`); los `[WARN]` de la salida del job
 * se agrupan juntos, porque su texto cambia en cada caso.
 */
function tipoDeAviso(aviso: string): { tipo: string; nodo?: string } {
  if (/^\s*\[WARN/.test(aviso)) return { tipo: "[WARN] en la salida del job" };
  const coincide = /^([^\s:]+): (.+)$/.exec(aviso);
  return coincide?.[1] !== undefined && coincide[2] !== undefined
    ? { tipo: coincide[2], nodo: coincide[1] }
    : { tipo: aviso };
}

/**
 * Vistas de Studio que se ocultan durante la corrida porque cuestan tiempo en cada job:
 * - Job Settings reconstruye sus pestanas (y el editor Markdown) al borrar un job: ~1,5 s por borrado.
 * La paleta de GEF no se oculta: se probo y no cambia lo que se acumula (ver docs/studio-internals, seccion 81).
 */
const VISTAS_PESADAS = [
  "org.talend.designer.core.ui.views.jobsettings.JobSettingsView",
];


async function main(): Promise<void> {
  if (suite && !suitesValidas.has(suite)) {
    throw new Error(`Suite desconocida '${suite}'. Opciones: ${[...suitesValidas].join(", ")}`);
  }

  // Se lee solo la suite pedida; el resto del catalogo no se parsea.
  const arbol = loadScenarioTree<Escenario>({ suite });
  if (arbol.issues.length > 0) {
    console.error(`Hay ${arbol.issues.length} problema(s) en los escenarios de ${arbol.root}:`);
    for (const problema of arbol.issues) console.error(`  ${problema.message}`);
    process.exit(1);
  }
  if (arbol.scenarios.length === 0) {
    console.error(`No hay escenarios en ${arbol.root}${suite ? `/${suite}` : ""}`);
    process.exit(1);
  }

  // `--validar` no necesita Studio: comprueba el catalogo y sale. Sirve para CI
  // y para revisar un fixture nuevo antes de gastar una corrida completa.
  if (soloValidar) {
    const porSuite = new Map<string, number>();
    for (const source of arbol.sources) {
      porSuite.set(source.suite, (porSuite.get(source.suite) ?? 0) + 1);
    }
    console.log(`Escenarios validos: ${arbol.scenarios.length} en ${porSuite.size} suite(s).`);
    for (const [nombre, cantidad] of [...porSuite].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${nombre.padEnd(18)} ${cantidad}`);
    }
    return;
  }

  const fallidosAnteriores = soloFallidos ? nombresFallidos(salidaCsv) : undefined;
  const cambiadosDesde = referenciaGit
    ? nombresCambiadosDesde(referenciaGit, arbol.sources)
    : undefined;
  const seleccionados = selectScenarios(arbol.scenarios, {
    nameFilter: filtro,
    suite,
    failedNames: fallidosAnteriores,
    changedNames: cambiadosDesde,
  });
  if (seleccionados.length === 0) {
    console.log("No hay escenarios que coincidan con los filtros.");
    return;
  }

  // El indice de definiciones lo necesitan la huella (para saltar lo ya probado)
  // y el montaje. Se carga sin bridge: `--sembrar` no necesita Studio.
  const [{ DefinitionIndexRepository }, { createBridgeClient, clearBridgeClientCache }, { prepararEscenario }] = await Promise.all([
    import("../src/modules/component-definitions/infrastructure/definition-index.repository"),
    import("../src/modules/studio-bridge/adapters/http-studio-bridge.client"),
    import("./l5/scenario-runner"),
  ]);
  const indice = await new DefinitionIndexRepository().load();
  const definiciones = new Map(indice.components.map((componente) => [componente.name, componente]));

  // La huella de un escenario usa solo las definiciones de los componentes que
  // usa: cambiar otro componente no invalida lo ya probado.
  const cache = leerCache(cachePath);
  const huellaDeCada = (escenario: Escenario) =>
    huellaDeEscenario(escenario, huellaDeDefiniciones(tiposDeComponentes(escenario), definiciones));

  if (sembrar) {
    // Primera vez que se usa la cache: lo que el informe ya da por bueno y no se
    // ha tocado despues se marca como probado, sin volver a ejecutarlo.
    const buenos = nombresOk(salidaCsv);
    const deseados = new Set(seleccionados.map((escenario) => escenario.nombre));
    const entradas = arbol.sources
      .filter((source) => deseados.has(source.scenario.nombre) && buenos.has(source.scenario.nombre))
      .map((source) => ({
        nombre: source.scenario.nombre,
        huella: huellaDeCada(source.scenario),
        mtimeFichero: statSync(source.path).mtimeMs,
      }));
    const mtimeInforme = statSync(salidaCsv).mtimeMs;
    const agregados = sembrarDesdeInforme(cache, entradas, mtimeInforme);
    escribirCache(cachePath, cache);
    console.log(
      `Cache: ${agregados} escenarios marcados como probados (salida correcta en ${salidaCsv} del ${new Date(mtimeInforme).toISOString()} y sin cambios despues).`,
    );
    return;
  }

  // El bridge solo se necesita para ejecutar: `--validar` y una seleccion vacia no lo cargan.
  let bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });
  // Sin bridge, cada escenario falla con el mismo error. Se corta antes de
  // montar nada, y el informe anterior no se sobrescribe con esos fallos.
  const latido = await bridge.ping();
  if (!latido.ok) {
    console.error(`No se ejecuta ningun escenario: ${errorDe(latido)}`);
    process.exitCode = 1;
    return;
  }

  // Lo que ya paso, con la misma huella (escenario y definiciones de componentes), no se
  // vuelve a ejecutar; `--todas` lo repite. La cache se guarda al terminar cada escenario.
  const pendientes = seleccionados.filter(
    (escenario) => todas || !estaProbado(cache, escenario.nombre, huellaDeCada(escenario)),
  );
  const omitidos = seleccionados.length - pendientes.length;
  if (pendientes.length === 0) {
    console.log(`Los ${omitidos} escenarios seleccionados ya estan probados sin cambios. Con --todas se repiten.`);
    return;
  }
  if (omitidos > 0) console.log(`${omitidos} ya probados sin cambios: se omiten (con --todas se repiten).`);

  const resultadosPrevios = leerResultados(salidaCsv);
  const resultadosActuales = new Map<string, string>();
  let bien = 0;
  let total = 0;

  // Se ocultan las vistas pesadas (ver VISTAS_PESADAS) y se vuelven a mostrar al terminar, solo las que estaban abiertas. Con
  // L5_VISTAS=conservar no se toca el IDE.
  const ocultarVistas = async (): Promise<string[]> =>
    process.env.L5_VISTAS === "conservar"
      ? []
      : (
          await Promise.all(
            VISTAS_PESADAS.map((vista) =>
              bridge.hideView(vista).then(
                (respuesta) => ((respuesta.data as { hidden?: boolean } | undefined)?.hidden === true ? vista : undefined),
                () => undefined,
              ),
            ),
          )
        ).filter((vista): vista is string => vista !== undefined);
  let vistasOcultadas = await ocultarVistas();

  /** Registra el resultado de un escenario: cuenta, cache e informe. Se llama al terminar cada uno. */
  /** Avisos de la corrida agrupados por tipo: cuantos casos los tienen y en que nodos. */
  const avisosPorTipo = new Map<string, { casos: Set<string>; nodos: Set<string> }>();
  const registrar = (escenario: Escenario, detalle: Resultado, inicio: number): void => {
    const correcto = detalle.ejecutaOk && detalle.salidaCorrecta;
    if (correcto) bien++;
    if (correcto) {
      cache[escenario.nombre] = { huella: huellaDeCada(escenario), fecha: new Date().toISOString() };
    } else {
      delete cache[escenario.nombre];
    }
    escribirCache(cachePath, cache);
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(
      `${correcto ? "OK   " : "FALLA"} ${escenario.nombre} (${segundos} s)` +
        (detalle.mensaje ? `: ${detalle.mensaje}` : ""),
    );
    resultadosActuales.set(escenario.nombre, filaResultado(escenario, detalle));
    for (const aviso of detalle.avisos ?? []) {
      const { tipo, nodo } = tipoDeAviso(aviso);
      const grupo = avisosPorTipo.get(tipo) ?? { casos: new Set<string>(), nodos: new Set<string>() };
      grupo.casos.add(escenario.nombre);
      if (nodo) grupo.nodos.add(nodo);
      avisosPorTipo.set(tipo, grupo);
    }
  };
  for (const escenario of pendientes) {
    // Cada Run deja memoria en Studio: antes de llenar el heap se para, y lo que
    // ya paso queda en la cache para el siguiente arranque.
    let { usado, hayMargen } = await margenDeMemoria(bridge);
    if (!hayMargen && reiniciarStudioSiHaceFalta) {
      console.log(`
Studio lleva el ${usado}% de su memoria: se reinicia para seguir.`);
      try {
        const { reiniciarStudio } = await import("./l5/studio-reiniciar");
        await reiniciarStudio();
        clearBridgeClientCache();
        bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });
        // Un Studio recien arrancado tiene las vistas abiertas: se vuelven a ocultar.
        vistasOcultadas = await ocultarVistas();
        ({ usado, hayMargen } = await margenDeMemoria(bridge));
      } catch (error) {
        console.log(`No se pudo reiniciar Studio: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!hayMargen) {
      console.log(
        `\nStudio lleva el ${usado}% de su memoria: se para aqui. Reinicia Studio y vuelve a ejecutar el mismo comando; los escenarios ya probados se omiten.`,
      );
      process.exitCode = 2;
      break;
    }
    total++;
    const inicio = Date.now();
    // Un escenario que revienta no puede abortar la corrida: se registra el error y
    // siguen los demas, para no perder el resto del informe.
    let detalle: Resultado;
    try {
      const preparado = await prepararEscenario(bridge, escenario, definiciones, modoEjecucion);
      detalle = await preparado.terminar();
    } catch (error) {
      detalle = {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: error instanceof Error ? error.message : String(error),
      };
    }
    registrar(escenario, detalle, inicio);
  }

  for (const vista of vistasOcultadas) await bridge.showView(vista).catch(() => undefined);
  for (const [nombre, linea] of resultadosActuales) resultadosPrevios.set(nombre, linea);
  escribirResultados(salidaCsv, resultadosPrevios.values());
  console.log(`\n${bien} de ${total} escenarios correctos. Informe en ${salidaCsv}`);
  if (avisosPorTipo.size > 0) {
    // Los avisos de Studio no fallan el escenario, pero se listan enteros: son configuraciones
    // que Studio marca y que conviene arreglar. El detalle completo esta en la columna `detalle`.
    const casosConAvisos = new Set([...avisosPorTipo.values()].flatMap((grupo) => [...grupo.casos]));
    console.log(`\nAvisos de Studio por tipo (${casosConAvisos.size} casos con avisos):`);
    const ordenados = [...avisosPorTipo].sort((a, b) => b[1].casos.size - a[1].casos.size);
    for (const [tipo, grupo] of ordenados) {
      const nodos = grupo.nodos.size > 0 ? `  [nodos: ${[...grupo.nodos].slice(0, 4).join(", ")}]` : "";
      console.log(`  ${String(grupo.casos.size).padStart(3)} casos  ${tipo}${nodos}`);
    }
  }
  if (bien !== total) process.exitCode = 1;
}

// Error de uso (suite desconocida, filtro sin resultados, CSV ausente): un
// mensaje y codigo 1, no una traza de stack.
try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
