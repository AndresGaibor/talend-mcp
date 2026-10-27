/**
 * Mide la cobertura de componentes de Talend que tiene el MCP.
 *
 *   bun run scripts/coverage.ts                    # todos los componentes
 *   bun run scripts/coverage.ts --filter tFile     # solo los que contienen ese texto
 *   bun run scripts/coverage.ts --max 50           # solo los primeros 50
 *   bun run scripts/coverage.ts --compile          # ademas genera el codigo y comprueba que compila (L4)
 *   bun run scripts/coverage.ts --family File/Input --solo-pendientes
 *   bun run scripts/coverage.ts --out informe.csv  # guarda el detalle
 *   bun run scripts/coverage.ts --solo-pendientes   # omite componentes ya compilados en una tanda anterior
 *   bun run scripts/coverage.ts --cancel           # para la medicion en marcha
 *
 * El informe sale en `testdata/cobertura.csv` con una fila por componente: si se pudo
 * crear, configurar, guardar en el job y borrar, y con que fallo. Para agrupar los
 * fallos por causa: `bun run scripts/coverage-summary.ts`.
 *
 * La medicion corre dentro de Studio (el bridge recorre el catalogo y monta un job de
 * pruebas) y tarda varios minutos. Se arranca y se consulta el progreso cada pocos
 * segundos: una sola peticion HTTP larga la cortaria el cliente a los 5 minutos.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { DefinitionIndexRepository } from "../../src/modules/component-definitions/infrastructure/definition-index.repository";
import { planMount } from "../../src/modules/component-definitions/application/plan-required-parameters.use-case";
import type { ComponentDefinition } from "../../src/modules/component-definitions/domain/component-definition.types";
import { filterUncompiled } from "../coverage-selection";

let args: string[] = [];

/**
 * Porcentaje de memoria del JVM a partir del cual se cancela la medicion.
 *
 * Con el heap lleno, el IDE deja de responder y hay que reiniciarlo: mejor
 * parar la medicion a tiempo.
 */
const LIMITE_MEMORIA_PORCENTAJE = 80;

/**
 * Porcentaje de memoria a partir del cual se fuerza una recoleccion de basura.
 *
 * El codigo generado de cada job se queda en el heap aunque el job se borre, asi
 * que la memoria sube componente a componente. Forzar el recolector antes de
 * decidir si hay que cancelar hace que la tanda aguante mucho mas (y evita
 * reiniciar Studio cada pocos componentes).
 */
const UMBRAL_RECOLECCION_PORCENTAJE = 60;

function valorDe(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

type Fila = Record<string, unknown>;
type Informe = {
  catalogSize?: number;
  tested?: number;
  created?: number;
  configured?: number;
  listed?: number;
  deleted?: number;
  failed?: number;
  saveFailed?: number;
  compile?: boolean;
  compiled?: number;
  cancelled?: boolean;
  components?: Fila[];
};
type Estado = {
  state?: string;
  total?: number;
  tested?: number;
  created?: number;
  failed?: number;
  saveFailed?: number;
  current?: string;
  elapsedMs?: number;
  error?: string;
  message?: string;
  alreadyRunning?: boolean;
  result?: Informe;
};

/** El bridge envuelve la respuesta en `result`; los tests de humo tambien la dan plana. */
function desenvolver(data: unknown): Estado {
  const envelope = data as { result?: Estado } | undefined;
  return (envelope?.result ?? envelope ?? {}) as Estado;
}

function guardarCsv(salida: string, filas: Fila[]): void {
  const lineas = [
    "componente,creado,configurado,guardado,en_el_job,borrado,parametros,montado,unique_name,error,compila,error_compilacion",
  ];
  for (const fila of filas) {
    lineas.push([
      String(fila.component ?? ""),
      fila.ok === true ? "si" : "no",
      fila.parametersApplied ? "si" : "no",
      fila.saved === false ? "no" : "si",
      fila.listed === true ? "si" : "no",
      fila.deleted === true ? "si" : "no",
      String(fila.parametersApplied ?? 0),
      String(fila.mounted ?? 0),
      String(fila.uniqueName ?? ""),
      `"${String(fila.error ?? fila.deleteError ?? "").replace(/"/g, '""')}"`,
      fila.compiles === undefined ? "" : fila.compiles === true ? "si" : "no",
      `"${String(fila.compileError ?? "").replace(/"/g, '""')}"`,
    ].join(","));
  }
  writeFileSync(salida, `${lineas.join("\n")}\n`, "utf8");
}

/**
 * Plan de montaje de los componentes del catalogo.
 *
 * Lo saca de las definiciones XML de la instalacion de Studio: cada
 * componente declara que parametros son obligatorios (con su valor por
 * defecto y cuando se ven) y que conectores admite.
 */
async function buildMountPlan(): Promise<Record<string, unknown>> {
  const repository = new DefinitionIndexRepository();
  const index = await repository.load();
  const mount: Record<string, unknown> = {};
  for (const definition of index.components) {
    if (definition.palette !== "DI") continue;
    mount[definition.name] = planMount(definition);
  }
  return mount;
}

/**
 * Los componentes a medir.
 *
 * Con `--family` se miden los de esa familia (los de "File/Input", "File/
 * Output"...); con `--components`, los que se pidan separados por comas. Con
 * `--sin-artefacto` se quedan solo los que no piden ningun artefacto de Maven
 * (los que compilan sin descargar nada). Sin ninguna de las tres, se mide el
 * catalogo Standard entero (lo filtra el bridge).
 */
async function selectComponents(mount: Record<string, unknown>): Promise<string[] | undefined> {
  const family = valorDe("--family");
  const explicit = valorDe("--components");
  const sinArtefacto = args.includes("--sin-artefacto");
  let selected: string[] | undefined;
  if (explicit) {
    selected = explicit
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  } else if (!family && !args.includes("--con-definicion") && !sinArtefacto) {
    selected = undefined;
  } else {
    const repository = new DefinitionIndexRepository();
    const index = await repository.load();
    if (args.includes("--con-definicion")) {
      // Los componentes que tienen definicion XML: son los que se pueden
      // configurar con el plan. Los otros tardan minutos buscando artefactos.
      selected = Object.keys(mount);
    } else {
      const wanted = (family ?? "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0);
      selected = index.components
        .filter(
          (definition) =>
            definition.palette === "DI" &&
            (wanted.length === 0 || definition.families.some((item) => wanted.includes(item.toLowerCase()))) &&
            (!sinArtefacto || !pideArtefacto(definition)),
        )
        .map((definition) => definition.name)
        .filter((name) => name in mount);
    }
  }

  if (!args.includes("--solo-pendientes")) return selected;
  const reports: string[] = [];
  if (existsSync("testdata")) {
    for (const file of readdirSync("testdata")) {
      if (!file.startsWith("cobertura") || !file.endsWith(".csv")) continue;
      reports.push(readFileSync(`testdata/${file}`, "utf8"));
    }
  }
  return filterUncompiled(selected ?? Object.keys(mount), reports);
}

/**
 * Si el componente exige algun artefacto de Maven.
 *
 * El build de Maven corre en modo offline, asi que un artefacto que no este en
 * el `.m2` de Studio hace fallar el build (y tarda ~50 s). Los componentes que
 * no piden nada se miden primero.
 */
function pideArtefacto(definition: ComponentDefinition): boolean {
  return (definition.imports ?? []).some((item) => item.required && Boolean(item.mvn));
}

async function main(): Promise<void> {
  const salida = valorDe("--out") ?? "testdata/cobertura.csv";
  const bridge = await createBridgeClient({ config: { timeoutMs: 60_000 } });

  if (args.includes("--cancel")) {
    const parada = await bridge.coverageStatus({ cancel: true });
    console.log(`Cancelacion pedida: ${JSON.stringify(desenvolver(parada.data))}`);
    return;
  }

  const filter = valorDe("--filter");
  const max = valorDe("--max");
  const compile = args.includes("--compile");
  const inicio = Date.now();

  // El plan de montaje de cada componente: que parametros obligatorios hay que
  // rellenar (los saca de la definicion XML de Studio) y si hay que
  // conectarle un origen o un destino. Sin destino, los componentes de la
  // generacion nueva fallan con "Missing output connection".
  const mount = await buildMountPlan();

  // Los componentes a medir: por defecto, los del catalogo Standard; con
  // --family, los de esa familia; con --components, los que se pidan.
  const components = await selectComponents(mount);

  const arranque = await bridge.coverage({
    filter,
    max: max ? Number(max) : undefined,
    compile,
    mount,
    components,
  });
  if (!arranque.ok) {
    console.error("No se pudo arrancar la medicion:", arranque.error?.message ?? arranque.rawText?.slice(0, 400));
    process.exit(1);
  }
  const primero = desenvolver(arranque.data);
  if (primero.alreadyRunning) {
    console.log("Ya habia una medicion en marcha: se sigue esa.");
  }
  console.log("Midiendo la cobertura de componentes...");

  let estado: Estado = primero;
  while (estado.state === "running") {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const respuesta = await bridge.coverageStatus();
    if (!respuesta.ok) {
      console.error(`\nSe perdio el contacto con el bridge: ${respuesta.error?.message}`);
      process.exit(1);
    }
    estado = desenvolver(respuesta.data);
    const hechos = estado.tested ?? 0;
    const total = estado.total ?? 0;
    const segundos = Math.round((Date.now() - inicio) / 1000);

    // La memoria de Studio: las mediciones largas la llenan (el codigo generado
    // de cada job) y el IDE deja de responder. Si se pasa del limite, se
    // cancela la medicion en vez de tumbar el Studio.
    const memoria = await bridge.memory();
    let usado = (memoria.data as { usedPercent?: number } | undefined)?.usedPercent ?? 0;

    // Antes de cancelar, se le pide al JVM que recoja: si la memoria era basura
    // (el codigo del job anterior), la medicion puede seguir.
    if (usado >= UMBRAL_RECOLECCION_PORCENTAJE && usado < LIMITE_MEMORIA_PORCENTAJE) {
      await bridge.memory({ gc: true });
      const despues = await bridge.memory();
      usado = (despues.data as { usedPercent?: number } | undefined)?.usedPercent ?? usado;
    }

    if (usado >= LIMITE_MEMORIA_PORCENTAJE) {
      console.error(
        `\n\nStudio lleva el ${usado}% de su memoria: se cancela la medicion (si no, el IDE se queda sin memoria).`,
      );
      await bridge.coverageStatus({ cancel: true });
      process.exit(1);
    }

    process.stdout.write(`\r  ${hechos}/${total} componentes, ${estado.failed ?? 0} fallidos, ${segundos} s, memoria ${usado}%   ${estado.current ?? ""}`.padEnd(110));
  }
  console.log("");

  const data = estado.result;
  if (estado.state === "failed" || !data) {
    console.error(`La medicion termino en estado '${estado.state}':`, estado.error ?? estado.message ?? "sin datos");
    process.exit(1);
  }

  guardarCsv(salida, data.components ?? []);

  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log("");
  console.log(`Catalogo de Talend:        ${data.catalogSize} componentes`);
  console.log(`Probados:                  ${data.tested}${data.cancelled ? " (cancelada)" : ""}`);
  console.log(`Creados:                   ${data.created}`);
  console.log(`Con parametros aplicados:  ${data.configured}`);
  console.log(`Guardados sin error:       ${(data.created ?? 0) - (data.saveFailed ?? 0)}`);
  if (data.compile) {
    console.log(`Compilan (L4):             ${data.compiled}`);
  }
  console.log(`En el job (listados):      ${data.listed}`);
  console.log(`Borrados del job:          ${data.deleted}`);
  console.log(`Fallidos:                  ${data.failed}`);
  console.log(`Detalle en:                ${salida}`);
  console.log(`Tiempo:                    ${segundos} s`);

  const fallos = (data.components ?? []).filter((fila) => fila.ok !== true).slice(0, 15);
  if (fallos.length > 0) {
    console.log("\nPrimeros fallos:");
    for (const fallo of fallos) {
      console.log(`  ${fallo.component}: ${fallo.error}`);
    }
  }
}

export async function ejecutar(argumentos: string[] = process.argv.slice(2)): Promise<void> {
  args = argumentos;
  await main();
}
