import { COLUMNAS_FASE0, imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Prueba de humo de la Fase 0.
 *
 * Crea el job desde cero, arrastra los componentes de la paleta, define el
 * schema, conecta y comprueba el `.item`.
 */
export default async function fase0(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE0_JOB ?? "MCP_Fase0_Zero";

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);

  imprimir("2. crear el job desde cero", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({ type: "tFixedFlowInput", label: "entrada", position: { x: 200, y: 100 } });
  imprimir("3. anadir tFixedFlowInput", entrada.data ?? entrada.error);
  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 520, y: 100 } });
  imprimir("4. anadir tLogRow", salida.data ?? salida.error);

  const uniqueEntrada = uniqueNameDe(entrada);
  const uniqueSalida = uniqueNameDe(salida);

  imprimir(
    "5. schema de la entrada",
    (
      await bridge.setNodeSchema({
        uniqueName: uniqueEntrada,
        columns: COLUMNAS_FASE0,
        values: [
          ["1", "Bogota", "100.5"],
          ["2", "Medellin", "200.25"],
        ],
      })
    ).data,
  );

  imprimir("6. conectar", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueSalida })).data);

  imprimir("7. nodos del job", (await bridge.listNodes()).data);
}
