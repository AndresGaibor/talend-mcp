/**
 * Genera los datos de prueba del MCP de Talend en `testdata/`.
 *
 *   bun run scripts/make-testdata.ts
 *   bun run scripts/make-testdata.ts --out <carpeta>   # no borra `testdata/`
 *
 * Los archivos traen trampas a proposito (separador `;`, tildes, nulos, filas
 * duplicadas, fechas en dos formatos, ids huerfanos, celdas combinadas,
 * numeros guardados como texto) para probar que los jobs respetan el esquema.
 *
 * La generacion vive en `scripts/testdata/`: CSV y JSON, XLSX (con su escritor
 * ZIP) y los datos fijos de Postgres. Con `--out` se puede regenerar en una
 * carpeta temporal y comparar sin tocar los datos locales.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { anchoFijoTxt, clientesCsv, clientesGrandeCsv, configJson, l5ClientesCsv, transaccionesCsv } from "./testdata/csv";
import { productosXlsx } from "./testdata/excel";
import { DOCKER_COMPOSE, INIT_SQL, RESULTADOS_HEADER } from "./testdata/sql";

const TESTDATA = join(import.meta.dir, "..", "testdata");
const FILAS_GRANDES = 500_000;

function destino(): string {
  const indice = process.argv.indexOf("--out");
  if (indice < 0) return resolve(TESTDATA);
  const carpeta = process.argv[indice + 1];
  if (!carpeta) throw new Error("Falta la carpeta despues de --out");
  return resolve(carpeta);
}

function main(): void {
  const dir = destino();
  // Solo la carpeta por defecto se limpia: una carpeta indicada con --out
  // puede tener otros archivos y no se borra.
  if (dir === resolve(TESTDATA) && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(join(dir, "sql"), { recursive: true });

  writeFileSync(join(dir, "clientes.csv"), clientesCsv(), "utf8");
  writeFileSync(join(dir, "transacciones.csv"), transaccionesCsv(), "utf8");
  writeFileSync(join(dir, "ancho_fijo.txt"), anchoFijoTxt(), "utf8");
  writeFileSync(join(dir, "config.json"), configJson(), "utf8");
  writeFileSync(join(dir, "productos.xlsx"), productosXlsx());
  writeFileSync(join(dir, "clientes_grande.csv"), clientesGrandeCsv(FILAS_GRANDES), "utf8");
  writeFileSync(join(dir, "docker-compose.yml"), DOCKER_COMPOSE, "utf8");
  writeFileSync(join(dir, "sql", "init.sql"), INIT_SQL, "utf8");
  writeFileSync(join(dir, "resultados.csv"), RESULTADOS_HEADER, "utf8");
  writeFileSync(join(dir, "l5_clientes.csv"), l5ClientesCsv(), "utf8");

  console.log("testdata generado en:", dir);
  for (const file of [
    "clientes.csv",
    "transacciones.csv",
    "productos.xlsx",
    "ancho_fijo.txt",
    "config.json",
    "clientes_grande.csv",
    "docker-compose.yml",
    "sql/init.sql",
    "resultados.csv",
    "l5_clientes.csv",
  ]) {
    console.log("  " + file);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
