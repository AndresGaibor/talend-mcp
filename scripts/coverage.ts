/**
 * Mide la cobertura de componentes de Talend que tiene el MCP.
 *
 *   bun run scripts/coverage.ts                    # todos los componentes
 *   bun run scripts/coverage.ts --filter tFile     # solo los queAccepted
 *   bun run scripts/coverage.ts --max 50           # solo los primeros 50
 *   bun run scripts/coverage.ts --out informe.csv  # guarda el detalle
 *
 * El informe sale en `testdata/cobertura.csv` con una fila por componente:
 * si se pudo crear, si acepto los parametros y con que fallo.
 *
 * La medicion la hace el bridge (que va al catalogo de Studio y monta un job
 * de pruebas), porque por HTTP seria mil y pico llamadas.
 */

import { writeFileSync } from "node:fs";
import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";

const args = process.argv.slice(2);

function valorDe(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

async function main(): Promise<void> {
  const filter = valorDe("--filter");
  const max = valorDe("--max");
  const salida = valorDe("--out") ?? "testdata/cobertura.csv";

  const bridge = await createBridgeClient({ config: { timeoutMs: 900_000 } });

  console.log("Midiendo la cobertura de componentes (esto tarda unos minutos)...");
  const inicio = Date.now();
  const result = await bridge.coverage({
    filter,
    max: max ? Number(max) : undefined,
  });

  const envelope = result.data as { result?: Record<string, unknown> } | undefined;
  const data = (envelope?.result ?? envelope) as {
    catalogSize?: number;
    tested?: number;
    created?: number;
    configured?: number;
    listed?: number;
    deleted?: number;
    failed?: number;
    components?: Array<Record<string, unknown>>;
  } | undefined;

  if (!data) {
    console.error("La medicion no ha devuelto datos:", result.rawText?.slice(0, 400) ?? result.error);
    process.exit(1);
  }

  const filas = ["componente,creado,configurado,en_el_job,borrado,parametros,unique_name,error"];
  for (const fila of data.components ?? []) {
    filas.push([
      String(fila.component ?? ""),
      String(fila.ok === true ? "si" : "no"),
      String(fila.parametersApplied ? "si" : "no"),
      String(fila.listed === true ? "si" : "no"),
      String(fila.deleted === true ? "si" : "no"),
      String(fila.parametersApplied ?? 0),
      String(fila.uniqueName ?? ""),
      `"${String(fila.error ?? fila.deleteError ?? "").replace(/"/g, '""')}"`,
    ].join(","));
  }
  writeFileSync(salida, `${filas.join("\n")}\n`, "utf8");

  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log("");
  console.log(`Catalogo de Talend:        ${data.catalogSize} componentes`);
  console.log(`Probados:                  ${data.tested}`);
  console.log(`Creados:                   ${data.created}`);
  console.log(`Con parametros aplicados:  ${data.configured}`);
  console.log(`En el job (listados):      ${data.listed}`);
  console.log(`Borrados del job:         ${data.deleted}`);
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

await main();
