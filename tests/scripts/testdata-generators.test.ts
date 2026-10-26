import { describe, expect, test } from "bun:test";

import {
  anchoFijoTxt,
  clientesCsv,
  clientesGrandeCsv,
  configJson,
  l5ClientesCsv,
  transaccionesCsv,
} from "../../scripts/testdata/csv";
import { productosXlsx } from "../../scripts/testdata/excel";
import { DOCKER_COMPOSE, INIT_SQL, RESULTADOS_HEADER } from "../../scripts/testdata/sql";

describe("datos de prueba generados", () => {
  test("clientes.csv conserva las trampas y los duplicados", () => {
    const lineas = clientesCsv().trimEnd().split("\n");
    expect(lineas).toHaveLength(13);
    expect(lineas[0]).toBe("id;nombre;fecha_alta;monto;estado;ciudad");
    expect(lineas[1]).toContain("Ana María Núñez");
    expect(lineas[2]).toContain("15/01/2023");
    expect(lineas[11]).toBe(lineas[1]);
  });

  test("transacciones.csv incluye la FK huerfana", () => {
    const lineas = transaccionesCsv().trimEnd().split("\n");
    expect(lineas).toHaveLength(11);
    expect(lineas[8]).toContain("T008;999");
  });

  test("ancho_fijo.txt respeta las cinco anchuras", () => {
    const lineas = anchoFijoTxt().trimEnd().split("\n");
    expect(lineas).toHaveLength(5);
    for (const linea of lineas) expect(linea).toHaveLength(70);
  });

  test("config.json se puede volver a leer", () => {
    const config = JSON.parse(configJson()) as { job: { nombre: string; parametros: { origen: { separador: string } } } };
    expect(config.job.nombre).toBe("carga_clientes");
    expect(config.job.parametros.origen.separador).toBe(";");
  });

  test("clientes_grande.csv genera la cabecera y las filas pedidas", () => {
    const lineas = clientesGrandeCsv(3).trimEnd().split("\n");
    expect(lineas).toHaveLength(4);
    expect(lineas[3]).toContain("Cliente 3");
  });

  test("l5_clientes.csv es limpio y termina en salto de linea", () => {
    const texto = l5ClientesCsv();
    expect(texto.endsWith("\n")).toBe(true);
    expect(texto.trimEnd().split("\n")).toHaveLength(5);
  });

  test("productos.xlsx es un zip con las dos hojas", () => {
    const bytes = productosXlsx();
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain("xl/worksheets/sheet1.xml");
    expect(texto).toContain("xl/worksheets/sheet2.xml");
    expect(texto).toContain("A2:C2");
  });

  test("los datos de Postgres declaran las dos tablas", () => {
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS clientes");
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS transacciones");
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS l5_salida");
    expect(INIT_SQL).toContain("FOREIGN KEY (id_cliente) REFERENCES clientes(id) NOT VALID");
    expect(DOCKER_COMPOSE).toContain("postgres:16-alpine");
    expect(RESULTADOS_HEADER.startsWith("fase,prueba")).toBe(true);
  });
});
