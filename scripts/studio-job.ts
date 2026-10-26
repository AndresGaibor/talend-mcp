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
 *
 * Las fases viven en `scripts/studio-job/`, una por archivo, y se cargan solo
 * cuando se piden: el comando se valida antes de crear el cliente del bridge.
 */

import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { FASES, comandoConocido, comandosDisponibles } from "./studio-job/fases";
import { imprimir, parseColumnas } from "./studio-job/shared";

const USO = `Uso: bun run scripts/studio-job.ts <${comandosDisponibles().join("|")}> [args]`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const comando = args[0];

  if (!comando) {
    console.error(USO);
    process.exit(1);
  }

  // El comando se comprueba antes de conectar: un error de uso no espera al
  // bridge ni deja un cliente abierto.
  if (!comandoConocido(comando)) {
    throw new Error(`Comando desconocido: ${comando}. ${USO}`);
  }

  // Compilar y ejecutar un job en Talend tarda: el timeout por defecto del
  // bridge (25 s) se queda corto.
  const bridge = await createBridgeClient({ config: { timeoutMs: 300_000 } });

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
      const data = (envelope?.result ?? envelope) as
        | {
            executed?: boolean;
            mainClass?: string;
            exitCode?: number | null;
            timedOut?: boolean;
            lines?: string[];
            error?: string;
          }
        | undefined;
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
    default: {
      const cargar = FASES[comando];
      // Ya se valido arriba; la guarda mantiene el tipo estrecho.
      if (!cargar) throw new Error(`Comando desconocido: ${comando}. ${USO}`);
      const { default: ejecutarFase } = await cargar();
      await ejecutarFase(bridge);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
