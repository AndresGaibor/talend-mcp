import { imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Fase 9: robustez del MCP.
 *
 * Cuatro comprobaciones: que la misma instruccion dos veces no duplique
 * componentes, que un componente que no existe avise claro, que un job de mas
 * de 15 componentes se monte bien y que un esquema de mas de 50 columnas
 * aguante.
 */
export default async function fase9(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE9_JOB ?? "MCP_Fase9_Robustez";

  // 1. Un componente que no existe.
  imprimir(
    "1. componente inexistente",
    (await bridge.addNode({
      type: "tComponenteQueNoExiste",
      label: "x",
    })).data ?? (await bridge.addNode({ type: "tComponenteQueNoExiste" })).error,
  );

  // 2. Idempotencia: el mismo nodo dos veces no se duplica solo.
  imprimir("2. borrar el job", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("3. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);
  const primero = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 100, y: 100 } });
  const uniquePrimero = uniqueNameDe(primero);
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
  imprimir("10. componentes al final", ((final.data as { result?: unknown[] })?.result ?? []).length);
}
