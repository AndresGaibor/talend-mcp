import { COLUMNAS_CLIENTES, imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Fase 1: archivos de texto.
 *
 * `tFileInputDelimited` leyendo el CSV de prueba (separador `;`, con tildes y
 * nulos) hacia un `tLogRow`. La configuracion es declarativa: parametros del
 * componente y schema del nodo.
 */
export default async function fase1(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE1_JOB ?? "MCP_Fase1_Archivos";
  const fichero = process.env.FASE1_FILE ?? `${process.cwd()}/testdata/clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const entrada = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "clientes",
    position: { x: 200, y: 100 },
    parameters: {
      FILENAME: { value: fichero },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  imprimir("3. anadir tFileInputDelimited", entrada.data ?? entrada.error);
  const uniqueEntrada = uniqueNameDe(entrada);

  const salida = await bridge.addNode({ type: "tLogRow", label: "salida", position: { x: 520, y: 100 } });
  imprimir("4. anadir tLogRow", salida.data ?? salida.error);
  const uniqueSalida = uniqueNameDe(salida);

  imprimir(
    "5. schema de la entrada",
    (
      await bridge.configureNode({
        uniqueName: uniqueEntrada,
        schema: [{ connector: "FLOW", name: uniqueEntrada, columns: COLUMNAS_CLIENTES }],
      })
    ).data,
  );

  imprimir(
    "6. schema de la salida",
    (
      await bridge.configureNode({
        uniqueName: uniqueSalida,
        schema: [{ connector: "FLOW", name: uniqueSalida, columns: COLUMNAS_CLIENTES }],
      })
    ).data,
  );

  imprimir("7. conectar", (await bridge.connectNodes({ source: uniqueEntrada, target: uniqueSalida })).data);
  imprimir("8. nodos del job", (await bridge.listNodes()).data);
}
