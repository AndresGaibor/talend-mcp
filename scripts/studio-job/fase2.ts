import { COLUMNAS_CLIENTES, imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Fase 2: tMap.
 *
 * Un `tMap` que renombra columnas, calcula un importe con iva y filtra las
 * filas que no estan activas. El modelo del tMap (entradas, salidas, filtros)
 * se declara con el bloque `mapper`.
 */
export default async function fase2(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE2_JOB ?? "MCP_Fase2_Map";
  const fichero = process.env.FASE2_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "clientes",
    position: { x: 160, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueEntrada = uniqueNameDe(entrada);
  imprimir("3. anadir tFileInputDelimited", entrada.data ?? entrada.error);

  const mapa = await bridge.addNode({
    type: "tMap",
    label: "mapeo",
    position: { x: 400, y: 100 },
  });
  const uniqueMapa = uniqueNameDe(mapa);
  imprimir("4. anadir tMap", mapa.data ?? mapa.error);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 640, y: 100 } });
  const uniqueSalida = uniqueNameDe(salida);
  imprimir("5. anadir tLogRow", salida.data ?? salida.error);

  imprimir(
    "6. schema de la entrada",
    (
      await bridge.configureNode({
        uniqueName: uniqueEntrada,
        schema: [{ connector: "FLOW", name: uniqueEntrada, columns: COLUMNAS_CLIENTES }],
      })
    ).data,
  );

  imprimir(
    "7. schema de la salida del tMap",
    (
      await bridge.configureNode({
        uniqueName: uniqueMapa,
        schema: [
          {
            connector: "FLOW",
            name: "out1",
            columns: [
              { name: "id_cliente", type: "id_Integer" },
              { name: "nombre", type: "id_String" },
              { name: "monto_iva", type: "id_Double" },
              { name: "estado", type: "id_String" },
            ],
          },
        ],
      })
    ).data,
  );

  imprimir(
    "8. schema de la salida",
    (
      await bridge.configureNode({
        uniqueName: uniqueSalida,
        schema: [
          {
            connector: "FLOW",
            name: uniqueSalida,
            columns: [
              { name: "id_cliente", type: "id_Integer" },
              { name: "nombre", type: "id_String" },
              { name: "monto_iva", type: "id_Double" },
              { name: "estado", type: "id_String" },
            ],
          },
        ],
      })
    ).data,
  );

  imprimir("9. conectar entrada -> tMap", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueMapa })).data);
  imprimir("10. conectar tMap -> salida", (await bridge.connectNodes({ source: uniqueMapa, target: uniqueSalida })).data);

  // El modelo del tMap se aplica AL FINAL: al conectar, Talend rehace las
  // tablas del mapper segun las conexiones y se pierde lo que se puso antes.
  imprimir(
    "11. modelo del tMap",
    (
      await bridge.configureNode({
        uniqueName: uniqueMapa,
        mapper: {
          inputs: [
            {
              name: "row1",
              matchingMode: "UNIQUE_MATCH",
              lookupMode: "LOAD_ONCE",
              columns: COLUMNAS_CLIENTES.map((columna) => ({ name: columna.name, type: columna.type })),
            },
          ],
          outputs: [
            {
              name: "out1",
              columns: [
                { name: "id_cliente", type: "id_Integer", expression: "row1.id" },
                { name: "nombre", type: "id_String", expression: "row1.nombre" },
                { name: "monto_iva", type: "id_Double", expression: "row1.monto * 1.12" },
                { name: "estado", type: "id_String", expression: "row1.estado" },
              ],
              filter: 'row1.estado.equals("ACTIVO")',
            },
          ],
        },
      })
    ).data,
  );

  imprimir("12. nodos del job", (await bridge.listNodes()).data);
}
