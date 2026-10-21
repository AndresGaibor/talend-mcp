/**
 * Cliente de linea de comandos para operar sobre el job abierto en Talend.
 *
 *   bun run scripts/studio-job.ts fase0
 *   bun run scripts/studio-job.ts create MCP_MiJob
 *   bun run scripts/studio-job.ts add tFileInputDelimited entrada
 *   bun run scripts/studio-job.ts connect tFileInputDelimited_1 tLogRow_1
 *   bun run scripts/studio-job.ts schema tFixedFlowInput_1 'id:id_Integer,ciudad:id_String'
 *   bun run scripts/studio-job.ts list
 *   bun run scripts/studio-job.ts delete MCP_MiJob
 *   bun run scripts/studio-job.ts dialogs
 *   bun run scripts/studio-job.ts run
 *
 * Habla con el bridge de Studio por HTTP: es mas rapido que ir por el MCP y
 * sirve para depurar paso a paso lo que hace cada operacion.
 *
 * El comando `fase0` ejecuta la prueba de humo completa: crea el job desde
 * cero arrastrando componentes de la paleta, define el schema, conecta y
 * comprueba el `.item` generado.
 */

import { createBridgeClient, type TalendStudioBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";

type Bridge = TalendStudioBridgeClient;

type Columna = { name: string; type: string };

const COLUMNAS_FASE0: Columna[] = [
  { name: "id", type: "id_Integer" },
  { name: "ciudad", type: "id_String" },
  { name: "monto", type: "id_Double" },
];

const COLUMNAS_CLIENTES: Columna[] = [
  { name: "id", type: "id_Integer" },
  { name: "nombre", type: "id_String" },
  { name: "fecha_alta", type: "id_Date" },
  { name: "monto", type: "id_Double" },
  { name: "estado", type: "id_String" },
  { name: "ciudad", type: "id_String" },
];

function imprimir(titulo: string, valor: unknown): void {
  console.log(`\n=== ${titulo} ===`);
  console.log(typeof valor === "string" ? valor : JSON.stringify(valor, null, 2));
}

function parseColumnas(texto: string): Columna[] {
  return texto
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      const [name, type] = parte.split(":");
      return { name: (name ?? "").trim(), type: (type ?? "id_String").trim() };
    });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const comando = args[0];
  // Compilar y ejecutar un job en Talend tarda: el timeout por defecto del
  // bridge (25 s) se queda corto.
  const bridge = await createBridgeClient({ config: { timeoutMs: 300_000 } });

  if (!comando) {
    console.error("Uso: bun run scripts/studio-job.ts <create|delete|open|add|connect|schema|list|run|dialogs|fase0> [args]");
    process.exit(1);
  }

  switch (comando) {
    case "create": {
      const name = args[1];
      if (!name) throw new Error("Falta el nombre del job");
      const result = await bridge.createJob({ name, replace: args.includes("--replace") });
      imprimir("create", result.data ?? result.error);
      break;
    }
    case "delete": {
      const name = args[1];
      if (!name) throw new Error("Falta el nombre del job");
      const result = await bridge.deleteJob({ name });
      imprimir("delete", result.data ?? result.error);
      break;
    }
    case "open": {
      const name = args[1];
      if (!name) throw new Error("Falta el nombre del job");
      const result = await bridge.openJob({ name });
      imprimir("open", result.data ?? result.error);
      break;
    }
    case "add": {
      const type = args[1];
      if (!type) throw new Error("Falta el tipo de componente");
      const result = await bridge.addNode({ type, label: args[2] });
      imprimir("add", result.data ?? result.error);
      break;
    }
    case "connect": {
      const source = args[1];
      const target = args[2];
      if (!source || !target) throw new Error("Faltan origen y destino");
      const result = await bridge.connectNodes({ source, target });
      imprimir("connect", result.data ?? result.error);
      break;
    }
    case "schema": {
      const uniqueName = args[1];
      if (!uniqueName) throw new Error("Falta el unique name del nodo");
      const columns = parseColumnas(args[2] ?? "");
      const result = await bridge.setNodeSchema({ uniqueName, columns });
      imprimir("schema", result.data ?? result.error);
      break;
    }
    case "list": {
      const result = await bridge.listNodes();
      imprimir("list", result.data ?? result.error);
      break;
    }
    case "run": {
      const result = await bridge.runActiveJob({ dryRun: false, waitForTermination: true, timeoutMs: 120000 });
      imprimir("run", result.data ?? result.error);
      break;
    }
    case "execute": {
      // Ejecuta el job generado y devuelve su salida: es la forma de
      // comprobar que el resultado es el esperado.
      const name = args[1];
      if (!name) throw new Error("Falta el nombre del job");
      const result = await bridge.executeJob({ name, version: args[2] });
      // El bridge envuelve el payload en `result`.
      const envelope = result.data as { result?: Record<string, unknown> } | undefined;
      const data = (envelope?.result ?? envelope) as {
        executed?: boolean;
        mainClass?: string;
        exitCode?: number | null;
        timedOut?: boolean;
        lines?: string[];
        error?: string;
      } | undefined;
      imprimir("execute", {
        executed: data?.executed,
        mainClass: data?.mainClass,
        exitCode: data?.exitCode,
        timedOut: data?.timedOut,
        error: data?.error,
      });
      imprimir("salida", data?.lines ?? []);
      break;
    }
    case "dialogs": {
      const result = await bridge.dismissDialogs();
      imprimir("dialogs", result.data ?? result.error);
      break;
    }
    case "fase0": {
      await fase0(bridge);
      break;
    }
    case "fase1": {
      await fase1(bridge);
      break;
    }
    case "fase2": {
      await fase2(bridge);
      break;
    }
    case "fase1b": {
      await fase1b(bridge);
      break;
    }
    case "fase3": {
      await fase3(bridge);
      break;
    }
    case "fase4": {
      await fase4(bridge);
      break;
    }
    case "fase6": {
      await fase6(bridge);
      break;
    }
    case "fase9": {
      await fase9(bridge);
      break;
    }
    default:
      throw new Error(`Comando desconocido: ${comando}`);
  }
}

/**
 * Prueba de humo de la Fase 0.
 *
 * Crea el job desde cero, arrastra los componentes de la paleta, define el
 * schema, conecta y comprueba el `.item`.
 */
async function fase0(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE0_JOB ?? "MCP_Fase0_Zero";

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);

  imprimir("2. crear el job desde cero", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({ type: "tFixedFlowInput", label: "entrada", position: { x: 200, y: 100 } });
  imprimir("3. anadir tFixedFlowInput", entrada.data ?? entrada.error);
  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 520, y: 100 } });
  imprimir("4. anadir tLogRow", salida.data ?? salida.error);

  const uniqueEntrada = String((entrada.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  const uniqueSalida = String((salida.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");

  imprimir("5. schema de la entrada",
    (await bridge.setNodeSchema({
      uniqueName: uniqueEntrada,
      columns: COLUMNAS_FASE0,
      values: [["1", "Bogota", "100.5"], ["2", "Medellin", "200.25"]],
    })).data);

  imprimir("6. conectar",
    (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueSalida })).data);

  imprimir("7. nodos del job", (await bridge.listNodes()).data);
}

/**
 * Fase 1: archivos de texto.
 *
 * `tFileInputDelimited` leyendo el CSV de prueba (separador `;`, con tildes y
 * nulos) hacia un `tLogRow`. La configuracion es declarativa: parametros del
 * componente y schema del nodo.
 */
async function fase1(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE1_JOB ?? "MCP_Fase1_Archivos";
  const fichero = process.env.FASE1_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "clientes",
    position: { x: 200, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  imprimir("3. anadir tFileInputDelimited", entrada.data ?? entrada.error);
  const uniqueEntrada = String((entrada.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 520, y: 100 } });
  imprimir("4. anadir tLogRow", salida.data ?? salida.error);
  const uniqueSalida = String((salida.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");

  imprimir("5. schema de la entrada", (await bridge.configureNode({
    uniqueName: uniqueEntrada,
    schema: [{ connector: "FLOW", name: uniqueEntrada, columns: COLUMNAS_CLIENTES }],
  })).data);

  imprimir("6. schema de la salida", (await bridge.configureNode({
    uniqueName: uniqueSalida,
    schema: [{ connector: "FLOW", name: uniqueSalida, columns: COLUMNAS_CLIENTES }],
  })).data);

  imprimir("7. conectar", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueSalida })).data);
  imprimir("8. nodos del job", (await bridge.listNodes()).data);
}

/**
 * Fase 1b: leer un fichero y escribir otro.
 *
 * Comprueba que la configuracion declarativa funciona igual con un
 * componente de escritura: `tFileOutputDelimited` con su fichero, su
 * separador y su codificacion.
 */
async function fase1b(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE1B_JOB ?? "MCP_Fase1b_EntradaSalida";
  const entrada = process.env.FASE1B_ENTRADA ?? `${process.cwd()}/testdata/clientes.csv`;
  const salida = process.env.FASE1B_SALIDA ?? `${process.cwd()}/testdata/salida_clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const lector = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "lee",
    position: { x: 160, y: 100 },
    parameters: {
      FILENAME: { value: entrada },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueLector = String((lector.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("3. anadir tFileInputDelimited", lector.data ?? lector.error);

  const escritor = await bridge.addNode({
    type: "tFileOutputDelimited",
    label: "escribe",
    position: { x: 460, y: 100 },
    parameters: {
      FILENAME: { value: salida },
      FIELDSEPARATOR: { value: ";" },
      ENCODING: { value: "UTF-8" },
      REPLACE_FILE: { value: "true" },
      CREATE_HEADER: { value: "false" },
    },
  });
  const uniqueEscritor = String((escritor.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("4. anadir tFileOutputDelimited", escritor.data ?? escritor.error);

  imprimir("5. schema de la entrada", (await bridge.configureNode({
    uniqueName: uniqueLector,
    schema: [{ connector: "FLOW", name: uniqueLector, columns: COLUMNAS_CLIENTES }],
  })).data);

  imprimir("6. schema de la salida", (await bridge.configureNode({
    uniqueName: uniqueEscritor,
    schema: [{ connector: "FLOW", name: uniqueEscritor, columns: COLUMNAS_CLIENTES }],
  })).data);

  imprimir("7. conectar", (await bridge.connectNodes({ source: uniqueLector, target: uniqueEscritor })).data);
  imprimir("8. nodos del job", (await bridge.listNodes()).data);
}

/**
 * Fase 9: robustez del MCP.
 *
 * Cuatro comprobaciones: que la misma instruccion dos veces no duplique
 * componentes, que un componente que no existe avise claro, que un job de mas
 * de 15 componentes se monte bien y que un esquema de mas de 50 columnas
 * aguante.
 */
async function fase9(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE9_JOB ?? "MCP_Fase9_Robustez";

  // 1. Un componente que no existe.
  imprimir("1. componente inexistente", (await bridge.addNode({
    type: "tComponenteQueNoExiste",
    label: "x",
  })).data ?? (await bridge.addNode({ type: "tComponenteQueNoExiste" })).error);

  // 2. Idempotencia: el mismo nodo dos veces no se duplica solo.
  imprimir("2. borrar el job", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("3. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);
  const primero = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 100, y: 100 } });
  const uniquePrimero = String((primero.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("4. anadir tLogRow (primera vez)", primero.data ?? primero.error);
  const repetido = await bridge.configureNode({ uniqueName: uniquePrimero, label: "salida" });
  imprimir("5. volver a configurar el mismo nodo", repetido.data ?? repetido.error);
  const despues = await bridge.listNodes();
  const total = ((despues.data as { result?: unknown[] })?.result ?? []).length;
  imprimir("6. componentes en el job (deben ser 1)", total);

  // 3. Un job de 16 componentes.
  imprimir("7. anadir 15 componentes mas", "...");
  for (let i = 0; i < 15; i++) {
    await bridge.addNode({ type: "tLogRow", label: `salida${i}`, position: { x: 100 + i * 40, y: 200 } });
  }
  const conMuchos = await bridge.listNodes();
  const totalMuchos = ((conMuchos.data as { result?: unknown[] })?.result ?? []).length;
  imprimir("8. componentes en el job", totalMuchos);

  // 4. Un esquema de 60 columnas.
  const columnas = Array.from({ length: 60 }, (_, i) => ({ name: `col_${i}`, type: "id_String" }));
  const conColumnas = await bridge.configureNode({
    uniqueName: uniquePrimero,
    schema: [{ connector: "FLOW", name: uniquePrimero, columns: columnas }],
  });
  imprimir("9. esquema de 60 columnas", conColumnas.data ?? conColumnas.error);

  // El job sigue en pie.
  const final = await bridge.listNodes();
  imprimir("10. componentes al final",
    ((final.data as { result?: unknown[] })?.result ?? []).length);
}

/**
 * Fase 6: orquestacion.
 *
 * Un job padre con `tPrejob` y `tPostjob`, y un `tRunJob` que llama a un job
 * hijo. Es la parte de orquestacion: el padre invoca al hijo y le puede pasar
 * el contexto.
 */
async function fase6(bridge: Bridge): Promise<void> {
  const padre = process.env.FASE6_JOB ?? "MCP_Fase6_Padre";
  const hijo = process.env.FASE6_HIJO ?? "MCP_Fase6_Hijo";

  // El job hijo: lee tres registros y los pasa al log.
  imprimir("1. borrar el job hijo", (await bridge.deleteJob({ name: hijo })).data);
  imprimir("2. crear el job hijo", (await bridge.createJob({ name: hijo, replace: true })).data);

  const entradaHijo = await bridge.addNode({
    type: "tFixedFlowInput",
    label: "entrada",
    position: { x: 160, y: 100 },
  });
  const uniqueEntradaHijo = String((entradaHijo.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  const logHijo = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 420, y: 100 } });
  const uniqueLogHijo = String((logHijo.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");

  const COLUMNAS_HIJO = [
    { name: "id", type: "id_Integer" },
    { name: "ciudad", type: "id_String" },
  ];
  for (const [nodo, columnas] of [
    [uniqueEntradaHijo, COLUMNAS_HIJO],
    [uniqueLogHijo, COLUMNAS_HIJO],
  ] as Array<[string, Columna[]]>) {
    imprimir(`3. schema de ${nodo}`, (await bridge.configureNode({
      uniqueName: nodo,
      schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
    })).data);
  }
  imprimir("4. datos del job hijo", (await bridge.setNodeSchema({
    uniqueName: uniqueEntradaHijo,
    columns: COLUMNAS_HIJO,
    values: [["1", "Bogota"], ["2", "Medellin"]],
  })).data);
  imprimir("5. conectar el job hijo", (await bridge.connectNodes({ source: uniqueEntradaHijo, target: uniqueLogHijo })).data);

  // El job padre.
  imprimir("6. borrar el job padre", (await bridge.deleteJob({ name: padre })).data);
  imprimir("7. crear el job padre", (await bridge.createJob({ name: padre, replace: true })).data);

  const pre = await bridge.addNode({ type: "tPrejob", label: "pre", position: { x: 160, y: 100 } });
  const uniquePre = String((pre.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("8. anadir tPrejob", pre.data ?? pre.error);

  const run = await bridge.addNode({
    type: "tRunJob",
    label: "llama al hijo",
    position: { x: 360, y: 100 },
    parameters: { PROCESS: { value: hijo } },
  });
  const uniqueRun = String((run.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("9. anadir tRunJob", run.data ?? run.error);

  const post = await bridge.addNode({ type: "tPostjob", label: "post", position: { x: 560, y: 100 } });
  const uniquePost = String((post.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("10. anadir tPostjob", post.data ?? post.error);

  imprimir("11. nodos del job padre", (await bridge.listNodes()).data);
}

/**
 * Fase 4: codigo Java.
 *
 * Un `tJavaRow` con codigo propio que calcula el iva y un acumulado. Es la
 * logica que el tMap no puede hacer solo (el acumulado, un RETAIN de SAS).
 *
 * La entrada es un `tFixedFlowInput` porque el `tJavaRow` usa el schema de su
 * propio nodo para leer y para escribir: si la entrada tiene mas columnas, las
 * filas no casan y se descartan.
 */
async function fase4(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE4_JOB ?? "MCP_Fase4_Java";

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFixedFlowInput",
    label: "entrada",
    position: { x: 140, y: 100 },
  });
  const uniqueEntrada = String((entrada.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("3. anadir tFixedFlowInput", entrada.data ?? entrada.error);

  const java = await bridge.addNode({
    type: "tJavaRow",
    label: "calcula",
    position: { x: 400, y: 100 },
    parameters: {
      CODE: {
        value: [
          "// El iva y un acumulado: la logica que el tMap no puede hacer solo.",
          "// Las variables locales se declaran aqui.",
          "double acumulado = 0;",
          "double monto = input_row.monto == null ? 0d : input_row.monto;",
          "acumulado = acumulado + monto;",
          "output_row.id = input_row.id;",
          "output_row.monto = monto;",
          "output_row.acumulado = acumulado;",
        ].join("\n"),
      },
    },
  });
  const uniqueJava = String((java.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("4. anadir tJavaRow", java.data ?? java.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 660, y: 100 } });
  const uniqueSalida = String((salida.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("5. anadir tLogRow", salida.data ?? salida.error);

  const COLUMNAS_JAVA = [
    { name: "id", type: "id_Integer" },
    { name: "monto", type: "id_Double" },
    { name: "acumulado", type: "id_Double" },
  ];

  for (const [nodo, columnas] of [
    [uniqueEntrada, COLUMNAS_JAVA],
    [uniqueJava, COLUMNAS_JAVA],
    [uniqueSalida, COLUMNAS_JAVA],
  ] as Array<[string, Columna[]]>) {
    imprimir(`6. schema de ${nodo}`, (await bridge.configureNode({
      uniqueName: nodo,
      schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
    })).data);
  }

  // Los datos de entrada: 3 registros de 100, 200 y 300.
  imprimir("7. datos de entrada", (await bridge.setNodeSchema({
    uniqueName: uniqueEntrada,
    columns: COLUMNAS_JAVA,
    values: [["1", "100", "0"], ["2", "200", "0"], ["3", "300", "0"]],
  })).data);

  imprimir("8. conectar", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueJava })).data);
  imprimir("9. conectar", (await bridge.connectNodes({ source: uniqueJava, target: uniqueSalida })).data);
  imprimir("10. nodos del job", (await bridge.listNodes()).data);
}

/**
 * Fase 3: transformaciones clasicas.
 *
 * `tUniqRow` (quitar duplicados), `tAggregateRow` (agrupar y sumar) y
 * `tSortRow` (ordenar) sobre el CSV de prueba.
 */
async function fase3(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE3_JOB ?? "MCP_Fase3_Transformaciones";
  const fichero = process.env.FASE3_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const lector = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "lee",
    position: { x: 120, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueLector = String((lector.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("3. anadir tFileInputDelimited", lector.data ?? lector.error);

  const filtro = await bridge.addNode({ type: "tUniqRow", label: "unicos", position: { x: 300, y: 100 } });
  const uniqueFiltro = String((filtro.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("4. anadir tUniqRow", filtro.data ?? filtro.error);

  const agregado = await bridge.addNode({ type: "tAggregateRow", label: "agrega", position: { x: 480, y: 100 } });
  const uniqueAgregado = String((agregado.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("5. anadir tAggregateRow", agregado.data ?? agregado.error);

  const orden = await bridge.addNode({ type: "tSortRow", label: "ordena", position: { x: 660, y: 100 } });
  const uniqueOrden = String((orden.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("6. anadir tSortRow", orden.data ?? orden.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 840, y: 100 } });
  const uniqueSalida = String((salida.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("7. anadir tLogRow", salida.data ?? salida.error);

  const COLUMNAS_AGREGADO = [
    { name: "estado", type: "id_String" },
    { name: "total_monto", type: "id_Double" },
    { name: "num_clientes", type: "id_Integer" },
  ];

  for (const [nodo, columnas] of [
    [uniqueLector, COLUMNAS_CLIENTES],
    [uniqueFiltro, COLUMNAS_CLIENTES],
    [uniqueAgregado, COLUMNAS_AGREGADO],
    [uniqueOrden, COLUMNAS_AGREGADO],
    [uniqueSalida, COLUMNAS_AGREGADO],
  ] as Array<[string, Columna[]]>) {
    imprimir(`8. schema de ${nodo}`, (await bridge.configureNode({
      uniqueName: nodo,
      schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
    })).data);
  }

  imprimir("9. conectar", (await bridge.connectNodes({ source: uniqueLector, target: uniqueFiltro })).data);
  imprimir("10. conectar", (await bridge.connectNodes({ source: uniqueFiltro, target: uniqueAgregado })).data);
  imprimir("11. conectar", (await bridge.connectNodes({ source: uniqueAgregado, target: uniqueOrden })).data);
  imprimir("12. conectar", (await bridge.connectNodes({ source: uniqueOrden, target: uniqueSalida })).data);

  // Los duplicados: la clave de unicidad. La tabla del tUniqRow tiene las
  // columnas que diga el catalogo del componente.
  imprimir("13. unicos", (await bridge.configureNode({
    uniqueName: uniqueFiltro,
    tables: {
      UNIQUE_KEY: {
        columns: ["SCHEMA_COLUMN", "KEY_ATTRIBUTE", "CASE_SENSITIVE"],
        rows: [{ SCHEMA_COLUMN: "row1.id", KEY_ATTRIBUTE: "false", CASE_SENSITIVE: "true" }],
      },
    },
  })).data);

  // La agregacion: agrupar por estado y sumar el monto (el equivalente a un
  // PROC SUMMARY).
  imprimir("14. agregacion", (await bridge.configureNode({
    uniqueName: uniqueAgregado,
    tables: {
      GROUPBYS: {
        columns: ["OUTPUT_COLUMN", "INPUT_COLUMN"],
        rows: [{ OUTPUT_COLUMN: "estado", INPUT_COLUMN: "row1.estado" }],
      },
      OPERATIONS: {
        columns: ["OUTPUT_COLUMN", "FUNCTION", "INPUT_COLUMN", "IGNORE_NULL"],
        rows: [
          { OUTPUT_COLUMN: "total_monto", FUNCTION: "SUM", INPUT_COLUMN: "row1.monto", IGNORE_NULL: "true" },
          { OUTPUT_COLUMN: "num_clientes", FUNCTION: "COUNT", INPUT_COLUMN: "row1.id", IGNORE_NULL: "true" },
        ],
      },
    },
  })).data);

  // La ordenacion: por total, de mayor a menor. La tabla del tSortRow tiene
  // las columnas COLNAME, SORT y ORDER.
  imprimir("15. orden", (await bridge.configureNode({
    uniqueName: uniqueOrden,
    tables: {
      CRITERIA: {
        columns: ["COLNAME", "SORT", "ORDER"],
        rows: [{ COLNAME: "row1.total_monto", SORT: "", ORDER: "DESC" }],
      },
    },
  })).data);

  imprimir("16. nodos del job", (await bridge.listNodes()).data);
}

/**
 * Fase 2: tMap.
 *
 * Un `tMap` que renombra columnas, calcula un importe con iva y filtra las
 * filas que no estan activas. El modelo del tMap (entradas, salidas, filtros)
 * se declara con el bloque `mapper`.
 */
async function fase2(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE2_JOB ?? "MCP_Fase2_Map";
  const fichero = process.env.FASE2_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "clientes",
    position: { x: 160, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueEntrada = String((entrada.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("3. anadir tFileInputDelimited", entrada.data ?? entrada.error);

  const mapa = await bridge.addNode({
    type: "tMap",
    label: "mapeo",
    position: { x: 400, y: 100 },
  });
  const uniqueMapa = String((mapa.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("4. anadir tMap", mapa.data ?? mapa.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 640, y: 100 } });
  const uniqueSalida = String((salida.data as { result?: { uniqueName?: string } })?.result?.uniqueName ?? "");
  imprimir("5. anadir tLogRow", salida.data ?? salida.error);

  imprimir("6. schema de la entrada", (await bridge.configureNode({
    uniqueName: uniqueEntrada,
    schema: [{ connector: "FLOW", name: uniqueEntrada, columns: COLUMNAS_CLIENTES }],
  })).data);

  imprimir("7. schema de la salida del tMap", (await bridge.configureNode({
    uniqueName: uniqueMapa,
    schema: [{
      connector: "FLOW",
      name: "out1",
      columns: [
        { name: "id_cliente", type: "id_Integer" },
        { name: "nombre", type: "id_String" },
        { name: "monto_iva", type: "id_Double" },
        { name: "estado", type: "id_String" },
      ],
    }],
  })).data);

  imprimir("8. schema de la salida", (await bridge.configureNode({
    uniqueName: uniqueSalida,
    schema: [{
      connector: "FLOW",
      name: uniqueSalida,
      columns: [
        { name: "id_cliente", type: "id_Integer" },
        { name: "nombre", type: "id_String" },
        { name: "monto_iva", type: "id_Double" },
        { name: "estado", type: "id_String" },
      ],
    }],
  })).data);

  imprimir("9. conectar entrada -> tMap", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueMapa })).data);
  imprimir("10. conectar tMap -> salida", (await bridge.connectNodes({ source: uniqueMapa, target: uniqueSalida })).data);

  // El modelo del tMap se aplica AL FINAL: al conectar, Talend rehace las
  // tablas del mapper segun las conexiones y se pierde lo que se puso antes.
  imprimir("11. modelo del tMap", (await bridge.configureNode({
    uniqueName: uniqueMapa,
    mapper: {
      inputs: [{
        name: "row1",
        matchingMode: "UNIQUE_MATCH",
        lookupMode: "LOAD_ONCE",
        columns: COLUMNAS_CLIENTES.map((columna) => ({ name: columna.name, type: columna.type })),
      }],
      outputs: [{
        name: "out1",
        columns: [
          { name: "id_cliente", type: "id_Integer", expression: "row1.id" },
          { name: "nombre", type: "id_String", expression: "row1.nombre" },
          { name: "monto_iva", type: "id_Double", expression: "row1.monto * 1.12" },
          { name: "estado", type: "id_String", expression: "row1.estado" },
        ],
        filter: "row1.estado.equals(\"ACTIVO\")",
      }],
    },
  })).data);

  imprimir("12. nodos del job", (await bridge.listNodes()).data);
}

await main();
