/**
 * Harness de ejecucion (L5): monta un job, lo ejecuta y comprueba que la
 * salida es la esperada.
 *
 *   bun run scripts/execution-check.ts                       # todas las pruebas
 *   bun run scripts/execution-check.ts archivos             # filtro por nombre
 *   bun run scripts/execution-check.ts --suite transformaciones
 *   bun run scripts/execution-check.ts --solo-fallidos       # reintenta los fallos del CSV anterior
 *   bun run scripts/execution-check.ts --todas               # repite tambien los que ya pasaron
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
import {
  escribirResultados,
  filaResultado,
  leerResultados,
  nombresFallidos,
} from "./l5/scenario-report";
import { errorDe } from "./l5/studio-retry";
import {
  escribirCache,
  estaProbado,
  huellaDe,
  huellaDeEscenario,
  huellaDelArnes,
  leerCache,
} from "./l5/scenario-cache";
import type { Escenario, Resultado } from "./l5/scenario-types";

const args = process.argv.slice(2);
const salidaCsv = "testdata/resultados-l5.csv";
const cachePath = "testdata/cache-l5.json";

const suite = argumento(args, "suite")?.toLowerCase();
const soloFallidos = args.includes("--solo-fallidos");
const soloValidar = args.includes("--validar");
const todas = args.includes("--todas");
const referenciaGit = argumento(args, "desde");
const filtro = posicional(args, ["--suite", "--desde"]);

const suitesValidas = new Set([...KNOWN_SUITES, "otros"]);

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

  // El bridge y el indice de definiciones solo se cargan cuando hay algo que
  // ejecutar: `--validar` y una seleccion vacia no pagan ese costo.
  const [{ createBridgeClient }, { DefinitionIndexRepository }, { ejecutar }] = await Promise.all([
    import("../src/modules/studio-bridge/adapters/http-studio-bridge.client"),
    import("../src/modules/component-definitions/infrastructure/definition-index.repository"),
    import("./l5/scenario-runner"),
  ]);

  const bridge = await createBridgeClient({ config: { timeoutMs: 180_000 } });
  // Sin bridge, cada escenario falla con el mismo error. Se corta antes de
  // montar nada, y el informe anterior no se sobrescribe con esos fallos.
  const latido = await bridge.ping();
  if (!latido.ok) {
    console.error(`No se ejecuta ningun escenario: ${errorDe(latido)}`);
    process.exitCode = 1;
    return;
  }
  const indice = await new DefinitionIndexRepository().load();
  const definiciones = new Map(indice.components.map((componente) => [componente.name, componente]));

  // Lo que ya paso, con la misma huella (escenario, arnes y contexto), no se vuelve a
  // ejecutar; `--todas` lo repite. La cache se guarda al terminar cada escenario.
  const cache = leerCache(cachePath);
  const huellaArnes = huellaDelArnes();
  const huellaContexto = huellaDe([latido.data?.version ?? "", JSON.stringify(indice.components)]);
  const huellaDeCada = (escenario: Escenario) => huellaDeEscenario(escenario, huellaArnes, huellaContexto);
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

  for (const escenario of pendientes) {
    total++;
    // Un escenario que revienta no puede abortar la corrida: se registra el
    // error y siguen los demas, para no perder el resto del informe.
    let detalle: Resultado;
    try {
      detalle = await ejecutar(bridge, escenario, definiciones);
    } catch (error) {
      detalle = {
        ejecutaOk: false,
        salidaCorrecta: false,
        mensaje: error instanceof Error ? error.message : String(error),
      };
    }
    const correcto = detalle.ejecutaOk && detalle.salidaCorrecta;
    if (correcto) bien++;
    if (correcto) {
      cache[escenario.nombre] = { huella: huellaDeCada(escenario), fecha: new Date().toISOString() };
    } else {
      delete cache[escenario.nombre];
    }
    escribirCache(cachePath, cache);
    console.log(
      `${correcto ? "OK   " : "FALLA"} ${escenario.nombre}` +
        (detalle.mensaje ? `: ${detalle.mensaje}` : ""),
    );
    resultadosActuales.set(escenario.nombre, filaResultado(escenario, detalle));
  }

  for (const [nombre, linea] of resultadosActuales) resultadosPrevios.set(nombre, linea);
  escribirResultados(salidaCsv, resultadosPrevios.values());
  console.log(`\n${bien} de ${total} escenarios correctos. Informe en ${salidaCsv}`);
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
