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

import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";

type Columna = { name: string; type: string };

const COLUMNAS_FASE0: Columna[] = [
  { name: "id", type: "id_Integer" },
  { name: "ciudad", type: "id_String" },
  { name: "monto", type: "id_Double" },
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
    case "dialogs": {
      const result = await bridge.dismissDialogs();
      imprimir("dialogs", result.data ?? result.error);
      break;
    }
    case "fase0": {
      await fase0(bridge);
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
async function fase0(bridge: Awaited<ReturnType<typeof createBridgeClient>>): Promise<void> {
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

await main();
