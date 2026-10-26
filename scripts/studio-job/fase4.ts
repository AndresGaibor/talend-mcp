import { imprimir, uniqueNameDe, type Bridge, type Columna } from "./shared";

/**
 * Fase 4: codigo Java.
 *
 * Un `tJavaRow` con codigo propio que calcula el iva y un acumulado. Es la
 * logica que el tMap no puede hacer solo (el acumulado, un RETAIN de SAS).
 *
 * La entrada es un `tFixedFlowInput` porque el `tJavaRow` usa el schema de su
 * propio nodo para leer y para escribir: si la entrada tiene mas columnas, las
 * filas no casan y se descartan.
 */
export default async function fase4(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE4_JOB ?? "MCP_Fase4_Java";

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFixedFlowInput",
    label: "entrada",
    position: { x: 140, y: 100 },
  });
  const uniqueEntrada = uniqueNameDe(entrada);
  imprimir("3. anadir tFixedFlowInput", entrada.data ?? entrada.error);

  const java = await bridge.addNode({
    type: "tJavaRow",
    label: "calcula",
    position: { x: 400, y: 100 },
    parameters: {
      CODE: {
        value: [
          "// El iva y un acumulado: la logica que el tMap no puede hacer solo.",
          "// Las variables locales se declaran aqui.",
          "double acumulado = 0;",
          "double monto = input_row.monto == null ? 0d : input_row.monto;",
          "acumulado = acumulado + monto;",
          "output_row.id = input_row.id;",
          "output_row.monto = monto;",
          "output_row.acumulado = acumulado;",
        ].join("\n"),
      },
    },
  });
  const uniqueJava = uniqueNameDe(java);
  imprimir("4. anadir tJavaRow", java.data ?? java.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 660, y: 100 } });
  const uniqueSalida = uniqueNameDe(salida);
  imprimir("5. anadir tLogRow", salida.data ?? salida.error);

  const COLUMNAS_JAVA = [
    { name: "id", type: "id_Integer" },
    { name: "monto", type: "id_Double" },
    { name: "acumulado", type: "id_Double" },
  ];

  for (const [nodo, columnas] of [
    [uniqueEntrada, COLUMNAS_JAVA],
    [uniqueJava, COLUMNAS_JAVA],
    [uniqueSalida, COLUMNAS_JAVA],
  ] as Array<[string, Columna[]]>) {
    imprimir(
      `6. schema de ${nodo}`,
      (
        await bridge.configureNode({
          uniqueName: nodo,
          schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
        })
      ).data,
    );
  }

  // Los datos de entrada: 3 registros de 100, 200 y 300.
  imprimir(
    "7. datos de entrada",
    (
      await bridge.setNodeSchema({
        uniqueName: uniqueEntrada,
        columns: COLUMNAS_JAVA,
        values: [
          ["1", "100", "0"],
          ["2", "200", "0"],
          ["3", "300", "0"],
        ],
      })
    ).data,
  );

  imprimir("8. conectar", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueJava })).data);
  imprimir("9. conectar", (await bridge.connectNodes({ source: uniqueJava, target: uniqueSalida })).data);
  imprimir("10. nodos del job", (await bridge.listNodes()).data);
}
