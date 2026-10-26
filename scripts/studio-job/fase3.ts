import { COLUMNAS_CLIENTES, imprimir, uniqueNameDe, type Bridge, type Columna } from "./shared";

/**
 * Fase 3: transformaciones clasicas.
 *
 * `tUniqRow` (quitar duplicados), `tAggregateRow` (agrupar y sumar) y
 * `tSortRow` (ordenar) sobre el CSV de prueba.
 */
export default async function fase3(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE3_JOB ?? "MCP_Fase3_Transformaciones";
  const fichero = process.env.FASE3_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const lector = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "lee",
    position: { x: 120, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueLector = uniqueNameDe(lector);
  imprimir("3. anadir tFileInputDelimited", lector.data ?? lector.error);

  const filtro = await bridge.addNode({ type: "tUniqRow", label: "unicos", position: { x: 300, y: 100 } });
  const uniqueFiltro = uniqueNameDe(filtro);
  imprimir("4. anadir tUniqRow", filtro.data ?? filtro.error);

  const agregado = await bridge.addNode({ type: "tAggregateRow", label: "agrega", position: { x: 480, y: 100 } });
  const uniqueAgregado = uniqueNameDe(agregado);
  imprimir("5. anadir tAggregateRow", agregado.data ?? agregado.error);

  const orden = await bridge.addNode({ type: "tSortRow", label: "ordena", position: { x: 660, y: 100 } });
  const uniqueOrden = uniqueNameDe(orden);
  imprimir("6. anadir tSortRow", orden.data ?? orden.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 840, y: 100 } });
  const uniqueSalida = uniqueNameDe(salida);
  imprimir("7. anadir tLogRow", salida.data ?? salida.error);

  const COLUMNAS_AGREGADO = [
    { name: "estado", type: "id_String" },
    { name: "total_monto", type: "id_Double" },
    { name: "num_clientes", type: "id_Integer" },
  ];

  for (const [nodo, columnas] of [
    [uniqueLector, COLUMNAS_CLIENTES],
    [uniqueFiltro, COLUMNAS_CLIENTES],
    [uniqueAgregado, COLUMNAS_AGREGADO],
    [uniqueOrden, COLUMNAS_AGREGADO],
    [uniqueSalida, COLUMNAS_AGREGADO],
  ] as Array<[string, Columna[]]>) {
    imprimir(
      `8. schema de ${nodo}`,
      (
        await bridge.configureNode({
          uniqueName: nodo,
          schema: [{ connector: "FLOW", name: nodo, columns: columnas }],
        })
      ).data,
    );
  }

  imprimir("9. conectar", (await bridge.connectNodes({ source: uniqueLector, target: uniqueFiltro })).data);
  imprimir("10. conectar", (await bridge.connectNodes({ source: uniqueFiltro, target: uniqueAgregado })).data);
  imprimir("11. conectar", (await bridge.connectNodes({ source: uniqueAgregado, target: uniqueOrden })).data);
  imprimir("12. conectar", (await bridge.connectNodes({ source: uniqueOrden, target: uniqueSalida })).data);

  // Los duplicados: la clave de unicidad. La tabla del tUniqRow tiene las
  // columnas que diga el catalogo del componente.
  imprimir(
    "13. unicos",
    (
      await bridge.configureNode({
        uniqueName: uniqueFiltro,
        tables: {
          UNIQUE_KEY: {
            columns: ["SCHEMA_COLUMN", "KEY_ATTRIBUTE", "CASE_SENSITIVE"],
            rows: [{ SCHEMA_COLUMN: "row1.id", KEY_ATTRIBUTE: "false", CASE_SENSITIVE: "true" }],
          },
        },
      })
    ).data,
  );

  // La agregacion: agrupar por estado y sumar el monto (el equivalente a un
  // PROC SUMMARY).
  imprimir(
    "14. agregacion",
    (
      await bridge.configureNode({
        uniqueName: uniqueAgregado,
        tables: {
          GROUPBYS: {
            columns: ["OUTPUT_COLUMN", "INPUT_COLUMN"],
            rows: [{ OUTPUT_COLUMN: "estado", INPUT_COLUMN: "row1.estado" }],
          },
          OPERATIONS: {
            columns: ["OUTPUT_COLUMN", "FUNCTION", "INPUT_COLUMN", "IGNORE_NULL"],
            rows: [
              { OUTPUT_COLUMN: "total_monto", FUNCTION: "SUM", INPUT_COLUMN: "row1.monto", IGNORE_NULL: "true" },
              { OUTPUT_COLUMN: "num_clientes", FUNCTION: "COUNT", INPUT_COLUMN: "row1.id", IGNORE_NULL: "true" },
            ],
          },
        },
      })
    ).data,
  );

  // La ordenacion: por total, de mayor a menor. La tabla del tSortRow tiene
  // las columnas COLNAME, SORT y ORDER.
  imprimir(
    "15. orden",
    (
      await bridge.configureNode({
        uniqueName: uniqueOrden,
        tables: {
          CRITERIA: {
            columns: ["COLNAME", "SORT", "ORDER"],
            rows: [{ COLNAME: "row1.total_monto", SORT: "", ORDER: "DESC" }],
          },
        },
      })
    ).data,
  );

  imprimir("16. nodos del job", (await bridge.listNodes()).data);
}
