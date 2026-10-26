import { imprimir, uniqueNameDe, type Bridge, type Columna } from "./shared";

/**
 * Fase 6: orquestacion.
 *
 * Un job padre con `tPrejob` y `tPostjob`, y un `tRunJob` que llama a un job
 * hijo. Es la parte de orquestacion: el padre invoca al hijo y le puede pasar
 * el contexto.
 */
export default async function fase6(bridge: Bridge): Promise<void> {
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
  const uniqueEntradaHijo = uniqueNameDe(entradaHijo);
  const logHijo = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 420, y: 100 } });
  const uniqueLogHijo = uniqueNameDe(logHijo);

  const COLUMNAS_HIJO = [
    { name: "id", type: "id_Integer" },
    { name: "ciudad", type: "id_String" },
  ];
  for (const [nodo, columnas] of [
    [uniqueEntradaHijo, COLUMNAS_HIJO],
    [uniqueLogHijo, COLUMNAS_HIJO],
  ] as Array<[string, Columna[]]>) {
    imprimir(
      `3. schema de ${nodo}`,
      (
        await bridge.configureNode({
          uniqueName: nodo,
          schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
        })
      ).data,
    );
  }
  imprimir(
    "4. datos del job hijo",
    (
      await bridge.setNodeSchema({
        uniqueName: uniqueEntradaHijo,
        columns: COLUMNAS_HIJO,
        values: [
          ["1", "Bogota"],
          ["2", "Medellin"],
        ],
      })
    ).data,
  );
  imprimir("5. conectar el job hijo", (await bridge.connectNodes({ source: uniqueEntradaHijo, target: uniqueLogHijo })).data);

  // El job padre.
  imprimir("6. borrar el job padre", (await bridge.deleteJob({ name: padre })).data);
  imprimir("7. crear el job padre", (await bridge.createJob({ name: padre, replace: true })).data);

  const pre = await bridge.addNode({ type: "tPrejob", label: "pre", position: { x: 160, y: 100 } });
  imprimir("8. anadir tPrejob", pre.data ?? pre.error);

  const run = await bridge.addNode({
    type: "tRunJob",
    label: "llama al hijo",
    position: { x: 360, y: 100 },
    parameters: { PROCESS: { value: hijo } },
  });
  imprimir("9. anadir tRunJob", run.data ?? run.error);

  const post = await bridge.addNode({ type: "tPostjob", label: "post", position: { x: 560, y: 100 } });
  imprimir("10. anadir tPostjob", post.data ?? post.error);

  imprimir("11. nodos del job padre", (await bridge.listNodes()).data);
}
