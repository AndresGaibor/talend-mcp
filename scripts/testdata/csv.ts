/**
 * Datos de prueba en texto: CSV y JSON.
 *
 * Las trampas son a proposito (separador `;`, tildes, nulos, duplicados,
 * fechas en dos formatos) para probar que los jobs respetan el esquema.
 */

function esc(value: string): string {
  if (value.includes('"')) return `"${value.replace(/"/g, '""')}"`;
  if (value.includes(";") || value.includes("\n") || value.includes(",")) return `"${value}"`;
  return value;
}

export function clientesCsv(): string {
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

export function transaccionesCsv(): string {
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

export function anchoFijoTxt(): string {
  // Layout posicional de 5 campos: id(8) nombre(30) fecha(10) monto(12) estado(10)
  const rows = [
    ["1", "Ana Maria Nunez", "2023-01-15", "1500.50", "ACTIVO"],
    ["2", "Jose Canizares", "2023-01-20", "2300", "ACTIVO"],
    ["3", "Lucia Pena", "2023-02-01", "875.25", "INACTIVO"],
    ["4", "Pedro Nono", "2023-02-05", "450", "ACTIVO"],
    ["5", "Maria Jose Munoz", "2023-03-10", "3210.75", "SUSPENDIDO"],
  ];
  const widths = [8, 30, 10, 12, 10];
  return (
    rows
      .map((row) => row.map((value, index) => value.padEnd(widths[index]!, " ")).join(""))
      .join("\n") + "\n"
  );
}

export function configJson(): string {
  return (
    JSON.stringify(
      {
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
      },
      null,
      2,
    ) + "\n"
  );
}

export function clientesGrandeCsv(rows: number): string {
  const out: string[] = ["id;nombre;fecha_alta;monto;estado;ciudad"];
  const ciudades = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"];
  for (let i = 1; i <= rows; i += 1) {
    const ciudad = ciudades[i % ciudades.length]!;
    out.push(`${i};Cliente ${i};2023-01-01;${(i % 10000) + 0.5};ACTIVO;${ciudad}`);
  }
  return out.join("\n") + "\n";
}

/**
 * CSV limpio para las pruebas de ejecucion (L5).
 *
 * A proposito no lleva trampas: el harness de ejecucion compara la salida
 * exacta, y una fila duplicada es lo que usa el `tUniqRow` para proving.
 */
export function l5ClientesCsv(): string {
  return [
    "id;nombre;ciudad;monto",
    "1;Ana;Bogota;100.5",
    "2;Jose;Medellin;200.25",
    "3;Lucia;Cali;300",
    "1;Ana;Bogota;100.5",
    "",
  ].join("\n");
}
