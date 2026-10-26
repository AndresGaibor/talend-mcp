import { imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Fase 5: otros formatos de fichero.
 *
 * `tFileInputPositional` (layout de ancho fijo, al estilo de los exportes de
 * SAS) y `tFileInputJSON` (registros anidados).
 */
export default async function fase5(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE5_JOB ?? "MCP_Fase5_Formatos";
  const posicional = process.env.FASE5_POSICIONAL ?? `${process.cwd()}/testdata/ancho_fijo.txt`;
  const json = process.env.FASE5_JSON ?? `${process.cwd()}/testdata/ventas.json`;

  imprimir("1. borrar el job", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  // El layout del fichero de ancho fijo: id(8) nombre(30) fecha(10)
  // monto(12) estado(10).
  const ANCHOS = [8, 30, 10, 12, 10];
  const COLUMNAS_POSICIONAL = [
    { name: "id", type: "id_Integer" },
    { name: "nombre", type: "id_String" },
    { name: "fecha", type: "id_Date" },
    { name: "monto", type: "id_Double" },
    { name: "estado", type: "id_String" },
  ];

  const fijo = await bridge.addNode({
    type: "tFileInputPositional",
    label: "ancho fijo",
    position: { x: 160, y: 100 },
    parameters: {
      FILENAME: { value: posicional },
      PATTERN: { value: ANCHOS.join(",") },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueFijo = uniqueNameDe(fijo);
  imprimir("3. anadir tFileInputPositional", fijo.data ?? fijo.error);

  const jsonNode = process.env.FASE5_SIN_JSON
    ? null
    : await bridge.addNode({
        type: "tFileInputJSON",
        label: "json",
        position: { x: 160, y: 260 },
        parameters: {
          FILENAME: { value: json },
          USEURL: { value: "false" },
          JSON_LOOP_QUERY: { value: "$.ventas[*]" },
          ENCODING: { value: "UTF-8" },
        },
      });
  const uniqueJson = uniqueNameDe(jsonNode ?? {});
  imprimir("4. anadir tFileInputJSON", jsonNode?.data ?? jsonNode?.error);

  const logFijo = await bridge.addNode({
    type: "tFileOutputDelimited",
    label: "salida fijo",
    position: { x: 460, y: 100 },
    parameters: {
      FILENAME: { value: process.env.FASE5_SALIDA ?? `${process.cwd()}/testdata/salida_posicional.csv` },
      FIELDSEPARATOR: { value: ";" },
      REPLACE_FILE: { value: "true" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueLogFijo = uniqueNameDe(logFijo);
  const logJson = jsonNode
    ? await bridge.addNode({ type: "tLogRow", label: "salida json", position: { x: 460, y: 260 } })
    : null;
  const uniqueLogJson = uniqueNameDe(logJson ?? {});

  imprimir(
    "5. schema del posicional",
    (
      await bridge.configureNode({
        uniqueName: uniqueFijo,
        schema: [{ connector: "FLOW", name: uniqueFijo, columns: COLUMNAS_POSICIONAL }],
        tables: {
          FORMATS: {
            columns: ["COLUMN", "SIZE", "PADDING_CHAR", "ALIGN"],
            rows: ANCHOS.map((ancho, indice) => ({
              COLUMN: String(indice + 1),
              SIZE: String(ancho),
              PADDING_CHAR: " ",
              ALIGN: "LEFT",
            })),
          },
        },
      })
    ).data,
  );

  if (uniqueJson)
    imprimir(
      "6. schema del json",
      (
        await bridge.configureNode({
          uniqueName: uniqueJson,
          schema: [
            {
              connector: "FLOW",
              name: uniqueJson,
              columns: [
                { name: "id", type: "id_Integer" },
                { name: "ciudad", type: "id_String" },
                { name: "monto", type: "id_Double" },
              ],
            },
          ],
          tables: {
            MAPPING: {
              columns: ["SCHEMA_COLUMN", "QUERY"],
              rows: [
                { SCHEMA_COLUMN: "id", QUERY: "id" },
                { SCHEMA_COLUMN: "ciudad", QUERY: "ciudad" },
                { SCHEMA_COLUMN: "monto", QUERY: "monto" },
              ],
            },
          },
        })
      ).data,
    );

  imprimir(
    "7. schema de las salidas",
    (
      await bridge.configureNode({
        uniqueName: uniqueLogFijo,
        schema: [{ connector: "FLOW", name: uniqueLogFijo, columns: COLUMNAS_POSICIONAL }],
      })
    ).data,
  );
  if (uniqueLogJson)
    imprimir(
      "8. schema de la salida json",
      (
        await bridge.configureNode({
          uniqueName: uniqueLogJson,
          schema: [
            {
              connector: "FLOW",
              name: uniqueLogJson,
              columns: [
                { name: "id", type: "id_Integer" },
                { name: "ciudad", type: "id_String" },
                { name: "monto", type: "id_Double" },
              ],
            },
          ],
        })
      ).data,
    );

  imprimir("9. conectar", (await bridge.connectNodes({ source: uniqueFijo, target: uniqueLogFijo })).data);
  if (uniqueJson && uniqueLogJson)
    imprimir("10. conectar", (await bridge.connectNodes({ source: uniqueJson, target: uniqueLogJson })).data);
  imprimir("11. nodos del job", (await bridge.listNodes()).data);
}
