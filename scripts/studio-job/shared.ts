import type { TalendStudioBridgeClient } from "../../src/modules/studio-bridge/adapters/http-studio-bridge.client";

/**
 * Piezas comunes de los comandos de `scripts/studio-job.ts`.
 *
 * Cada fase vive en su propio archivo para que el CLI se lea por comandos y
 * no por un unico bloque de casi mil lineas.
 */

export type Bridge = TalendStudioBridgeClient;

export type Columna = { name: string; type: string };

export const COLUMNAS_FASE0: Columna[] = [
  { name: "id", type: "id_Integer" },
  { name: "ciudad", type: "id_String" },
  { name: "monto", type: "id_Double" },
];

export const COLUMNAS_CLIENTES: Columna[] = [
  { name: "id", type: "id_Integer" },
  { name: "nombre", type: "id_String" },
  { name: "fecha_alta", type: "id_Date" },
  { name: "monto", type: "id_Double" },
  { name: "estado", type: "id_String" },
  { name: "ciudad", type: "id_String" },
];

/** Imprime un bloque con su titulo. */
export function imprimir(titulo: string, valor: unknown): void {
  console.log(`\n=== ${titulo} ===`);
  console.log(typeof valor === "string" ? valor : JSON.stringify(valor, null, 2));
}

/**
 * Nombre unico que devuelve el bridge al anadir un nodo.
 *
 * El bridge envuelve la respuesta en `result`; si no viene, queda vacio y el
 * error se ve al configurar el nodo siguiente.
 */
export function uniqueNameDe(respuesta: { data?: unknown }): string {
  const cuerpo = respuesta.data as { result?: { uniqueName?: string }; uniqueName?: string } | undefined;
  return String(cuerpo?.result?.uniqueName ?? cuerpo?.uniqueName ?? "");
}

/** Columnas del comando `schema`: `id:id_Integer,ciudad:id_String`. */
export function parseColumnas(texto: string): Columna[] {
  return texto
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      const [name, type] = parte.split(":");
      return { name: (name ?? "").trim(), type: (type ?? "id_String").trim() };
    });
}
