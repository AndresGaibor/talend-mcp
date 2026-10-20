/**
 * Genera los datos de prueba del MCP de Talend en `testdata/`.
 *
 *   bun run scripts/make-testdata.ts
 *
 * Los archivos traen trampas a proposito (separador `;`, tildes, nulos, filas
 * duplicadas, fechas en dos formatos, ids huerfanos, celdas combinadas,
 * numeros guardados como texto) para probar que los jobs respetan el esquema.
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Escritor ZIP minimo (sin compresion) ────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff;
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

/** Crea un zip sin compresion con las entradas dadas (path -> contenido). */
function writeZip(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const { time, date } = dosDateTime(new Date());
    const local = new Uint8Array(30 + nameBytes.length + size);
    const view = new DataView(local.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    chunks.push(local);

    const header = new Uint8Array(46 + nameBytes.length);
    const hview = new DataView(header.buffer);
    hview.setUint32(0, 0x02014b50, true);
    hview.setUint16(4, 20, true);
    hview.setUint16(6, 20, true);
    hview.setUint16(8, 0, true);
    hview.setUint16(10, 0, true);
    hview.setUint16(12, time, true);
    hview.setUint16(14, date, true);
    hview.setUint32(16, crc, true);
    hview.setUint32(20, size, true);
    hview.setUint32(24, size, true);
    hview.setUint16(28, nameBytes.length, true);
    hview.setUint16(30, 0, true);
    hview.setUint16(32, 0, true);
    hview.setUint16(34, 0, true);
    hview.setUint16(36, 0, true);
    hview.setUint32(38, 0, true);
    hview.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    central.push(header);

    offset += local.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, entries.length, true);
  eview.setUint16(10, entries.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of chunks) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of central) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(end, cursor);
  return out;
}

// ─── Generadores ─────────────────────────────────────────────────────────────

const TESTDATA = join(import.meta.dir, "..", "testdata");

function esc(value: string): string {
  if (value.includes('"')) return `"${value.replace(/"/g, '""')}"`;
  if (value.includes(";") || value.includes("\n") || value.includes(",")) return `"${value}"`;
  return value;
}

function clientesCsv(): string {
  const rows: string[][] = [
    ["id", "nombre", "fecha_alta", "monto", "estado", "ciudad"],
    ["1", "Ana María Núñez", "2023-01-15", "1500.50", "ACTIVO", "Bogotá"],
    ["2", "José Cañizares", "15/01/2023", "2300", "ACTIVO", "Medellín"],
    ["3", "Lucía Peña", "2023-02-01", "", "INACTIVO", "Cali"],
    ["4", "Pedro Ñoño", "01/02/2023", "875.25", "ACTIVO", "Barranquilla"],
    ["5", "María José Muñoz", "2023-03-10", "3210.75", "SUSPENDIDO", "Bogotá"],
    ["6", "Andrés Villalba", "10/03/2023", "999.99", "ACTIVO", "Cartagena"],
    ["7", "Camila Gómez", "2023-04-01", "0", "ACTIVO", "Bucaramanga"],
    ["8", "", "2023-04-15", "450", "ACTIVO", "Pereira"],
    ["9", "Tomás O'Brien", "15/04/2023", "1250", "INACTIVO", "Santa Marta"],
    ["10", "Sofía Ramírez", "2023-05-01", "750.25", "ACTIVO", "Bogotá"],
    // Duplicados exactos
    ["1", "Ana María Núñez", "2023-01-15", "1500.50", "ACTIVO", "Bogotá"],
    ["5", "María José Muñoz", "2023-03-10", "3210.75", "SUSPENDIDO", "Bogotá"],
  ];
  return rows.map((row) => row.map(esc).join(";")).join("\n") + "\n";
}

function transaccionesCsv(): string {
  const rows: string[][] = [
    ["id_tx", "id_cliente", "monto", "fecha"],
    ["T001", "1", "250.00", "2023-06-01"],
    ["T002", "2", "1300.50", "02/06/2023"],
    ["T003", "3", "99.99", "2023-06-03"],
    ["T004", "4", "4500", "04/06/2023"],
    ["T005", "5", "75.25", "2023-06-05"],
    ["T006", "6", "180.00", "06/06/2023"],
    ["T007", "7", "620.10", "2023-06-07"],
    // id_cliente inexistente: debe ser rechazado por la FK
    ["T008", "999", "300.00", "2023-06-08"],
    ["T009", "10", "45.99", "09/06/2023"],
    ["T010", "8", "1200.00", "10/06/2023"],
  ];
  return rows.map((row) => row.map(esc).join(";")).join("\n") + "\n";
}

function anchoFijoTxt(): string {
  // Layout posicional de 5 campos: id(8) nombre(30) fecha(10) monto(12) estado(10)
  const rows = [
    ["1", "Ana Maria Nunez", "2023-01-15", "1500.50", "ACTIVO"],
    ["2", "Jose Canizares", "2023-01-20", "2300", "ACTIVO"],
    ["3", "Lucia Pena", "2023-02-01", "875.25", "INACTIVO"],
    ["4", "Pedro Nono", "2023-02-05", "450", "ACTIVO"],
    ["5", "Maria Jose Munoz", "2023-03-10", "3210.75", "SUSPENDIDO"],
  ];
  const widths = [8, 30, 10, 12, 10];
  return rows
    .map((row) => row.map((value, index) => value.padEnd(widths[index]!, " ")).join(""))
    .join("\n") + "\n";
}

function configJson(): string {
  return JSON.stringify({
    job: {
      nombre: "carga_clientes",
      version: "0.1",
      parametros: {
        origen: { tipo: "csv", ruta: "clientes.csv", separador: ";" },
        destino: { tipo: "csv", ruta: "salida.csv" },
        reglas: [
          { campo: "monto", tipo: "numero", decimales: 2, defecto: 0 },
          { campo: "estado", tipo: "texto", valores: ["ACTIVO", "INACTIVO", "SUSPENDIDO"], defecto: "ACTIVO" },
        ],
        umbrales: { montoAlto: 2000, lote: 5000 },
      },
    },
  }, null, 2) + "\n";
}

function clientesGrandeCsv(rows: number): string {
  const out: string[] = ["id;nombre;fecha_alta;monto;estado;ciudad"];
  const ciudades = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"];
  for (let i = 1; i <= rows; i += 1) {
    const ciudad = ciudades[i % ciudades.length]!;
    out.push(`${i};Cliente ${i};2023-01-01;${(i % 10000) + 0.5};ACTIVO;${ciudad}`);
  }
  return out.join("\n") + "\n";
}

// ─── XLSX minimo ─────────────────────────────────────────────────────────────

function escXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cell(ref: string, value: string | number, asText: boolean): string {
  if (asText) {
    return `<c r="${ref}" t="inlineStr"><is><t>${escXml(String(value))}</t></is></c>`;
  }
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escXml(value)}</t></is></c>`;
}

function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows: Array<Array<string | number>>, asTextColumns: number[], merges: string[]): string {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => cell(`${columnName(colIndex + 1)}${rowIndex + 1}`, value, asTextColumns.includes(colIndex)))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const mergeBlock = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData>${mergeBlock}</worksheet>`;
}

function productosXlsx(): Uint8Array {
  const hoja1: Array<Array<string | number>> = [
    [],
    [],
    ["codigo", "nombre", "precio", "cantidad", "categoria"],
    ["P001", "Widget basico", "19.99", 100, "general"],
    ["P002", "Widget premium", "149.50", 25, "general"],
    ["P003", "Servicio anual", "999.00", 5, "servicios"],
  ];
  // merged: A2:C2 (encabezado desplazado a la fila 3 con A2:C2 combinado)
  const hoja1Xml = sheetXml(hoja1, [2], ["A2:C2"]);

  const hoja2: Array<Array<string | number>> = [
    ["region", "ventas_2023", "ventas_2024"],
    ["NORTE", 1200.5, 1500.75],
    ["CENTRO", 800, 950.25],
    ["SUR", 640.75, 720],
  ];
  const hoja2Xml = sheetXml(hoja2, [], []);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Productos" sheetId="1" r:id="rId1"/><sheet name="Ventas" sheetId="2" r:id="rId2"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`;

  const encoder = new TextEncoder();
  return writeZip([
    { path: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { path: "_rels/.rels", data: encoder.encode(rootRels) },
    { path: "xl/workbook.xml", data: encoder.encode(workbook) },
    { path: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { path: "xl/worksheets/sheet1.xml", data: encoder.encode(hoja1Xml) },
    { path: "xl/worksheets/sheet2.xml", data: encoder.encode(hoja2Xml) },
  ]);
}

// ─── Postgres ────────────────────────────────────────────────────────────────

const DOCKER_COMPOSE = `services:
  postgres:
    image: postgres:16-alpine
    container_name: talend_mcp_pg
    environment:
      POSTGRES_USER: talend
      POSTGRES_PASSWORD: talend
      POSTGRES_DB: talend_test
    ports:
      - "5433:5432"
    volumes:
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`;

const INIT_SQL = `-- Carga inicial para las pruebas del MCP de Talend.
CREATE TABLE IF NOT EXISTS clientes (
  id            integer PRIMARY KEY,
  nombre        varchar(120),
  fecha_alta    date,
  monto         numeric(12,2),
  estado        varchar(20),
  ciudad        varchar(60)
);

CREATE TABLE IF NOT EXISTS transacciones (
  id_tx        varchar(20) PRIMARY KEY,
  id_cliente   integer NOT NULL REFERENCES clientes(id),
  monto        numeric(12,2) NOT NULL,
  fecha        date NOT NULL
);

INSERT INTO clientes (id, nombre, fecha_alta, monto, estado, ciudad) VALUES
  (1, 'Ana María Núñez', '2023-01-15', 1500.50, 'ACTIVO', 'Bogotá'),
  (2, 'José Cañizares', '2023-01-15', 2300.00, 'ACTIVO', 'Medellín'),
  (3, 'Lucía Peña', '2023-02-01', NULL, 'INACTIVO', 'Cali'),
  (4, 'Pedro Ñoño', '2023-02-01', 875.25, 'ACTIVO', 'Barranquilla'),
  (5, 'María José Muñoz', '2023-03-10', 3210.75, 'SUSPENDIDO', 'Bogotá'),
  (6, 'Andrés Villalba', '2023-03-10', 999.99, 'ACTIVO', 'Cartagena'),
  (7, 'Camila Gómez', '2023-04-01', 0.00, 'ACTIVO', 'Bucaramanga'),
  (8, '', '2023-04-15', 450.00, 'ACTIVO', 'Pereira'),
  (9, 'Tomás O''Brien', '2023-04-15', 1250.00, 'INACTIVO', 'Santa Marta'),
  (10, 'Sofía Ramírez', '2023-05-01', 750.25, 'ACTIVO', 'Bogotá');

INSERT INTO transacciones (id_tx, id_cliente, monto, fecha) VALUES
  ('T001', 1, 250.00, '2023-06-01'),
  ('T002', 2, 1300.50, '2023-06-02'),
  ('T003', 3, 99.99, '2023-06-03'),
  ('T004', 4, 4500.00, '2023-06-04'),
  ('T005', 5, 75.25, '2023-06-05'),
  ('T006', 6, 180.00, '2023-06-06'),
  ('T007', 7, 620.10, '2023-06-07'),
  ('T008', 999, 300.00, '2023-06-08'),
  ('T009', 10, 45.99, '2023-06-09'),
  ('T010', 8, 1200.00, '2023-06-10');
`;

const RESULTADOS_HEADER = "fase,prueba,prompt_usado,genera_ok,abre_ok,ejecuta_ok,salida_correcta,tiempo_min,notas\n";

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const dir = TESTDATA;
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(join(dir, "sql"), { recursive: true });

  writeFileSync(join(dir, "clientes.csv"), clientesCsv(), "utf8");
  writeFileSync(join(dir, "transacciones.csv"), transaccionesCsv(), "utf8");
  writeFileSync(join(dir, "ancho_fijo.txt"), anchoFijoTxt(), "utf8");
  writeFileSync(join(dir, "config.json"), configJson(), "utf8");
  writeFileSync(join(dir, "productos.xlsx"), productosXlsx());
  writeFileSync(join(dir, "clientes_grande.csv"), clientesGrandeCsv(500_000), "utf8");
  writeFileSync(join(dir, "docker-compose.yml"), DOCKER_COMPOSE, "utf8");
  writeFileSync(join(dir, "sql", "init.sql"), INIT_SQL, "utf8");
  writeFileSync(join(dir, "resultados.csv"), RESULTADOS_HEADER, "utf8");

  console.log("testdata generado en:", dir);
  for (const file of ["clientes.csv", "transacciones.csv", "productos.xlsx", "ancho_fijo.txt", "config.json", "clientes_grande.csv", "docker-compose.yml", "sql/init.sql", "resultados.csv"]) {
    console.log("  " + file);
  }
}

main();
