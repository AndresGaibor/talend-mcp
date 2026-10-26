import { COLUMNAS_CLIENTES, imprimir, uniqueNameDe, type Bridge } from "./shared";

/**
 * Fase 1b: leer un fichero y escribir otro.
 *
 * Comprueba que la configuracion declarativa funciona igual con un
 * componente de escritura: `tFileOutputDelimited` con su fichero, su
 * separador y su codificacion.
 */
export default async function fase1b(bridge: Bridge): Promise<void> {
  const nombre = process.env.FASE1B_JOB ?? "MCP_Fase1b_EntradaSalida";
  const entrada = process.env.FASE1B_ENTRADA ?? `${process.cwd()}/testdata/clientes.csv`;
  const salida = process.env.FASE1B_SALIDA ?? `${process.cwd()}/testdata/salida_clientes.csv`;

  imprimir("1. borrar el job si existe", (await bridge.deleteJob({ name: nombre })).data);
  imprimir("2. crear el job", (await bridge.createJob({ name: nombre, replace: true })).data);

  const lector = await bridge.addNode({
    type: "tFileInputDelimited",
    label: "lee",
    position: { x: 160, y: 100 },
    parameters: {
      FILENAME: { value: entrada },
      FIELDSEPARATOR: { value: ";" },
      HEADER: { value: "1" },
      ENCODING: { value: "UTF-8" },
    },
  });
  const uniqueLector = uniqueNameDe(lector);
  imprimir("3. anadir tFileInputDelimited", lector.data ?? lector.error);

  const escritor = await bridge.addNode({
    type: "tFileOutputDelimited",
    label: "escribe",
    position: { x: 460, y: 100 },
    parameters: {
      FILENAME: { value: salida },
      FIELDSEPARATOR: { value: ";" },
      ENCODING: { value: "UTF-8" },
      REPLACE_FILE: { value: "true" },
      CREATE_HEADER: { value: "false" },
    },
  });
  const uniqueEscritor = uniqueNameDe(escritor);
  imprimir("4. anadir tFileOutputDelimited", escritor.data ?? escritor.error);

  imprimir(
    "5. schema de la entrada",
    (
      await bridge.configureNode({
        uniqueName: uniqueLector,
        schema: [{ connector: "FLOW", name: uniqueLector, columns: COLUMNAS_CLIENTES }],
      })
    ).data,
  );

  imprimir(
    "6. schema de la salida",
    (
      await bridge.configureNode({
        uniqueName: uniqueEscritor,
        schema: [{ connector: "FLOW", name: uniqueEscritor, columns: COLUMNAS_CLIENTES }],
      })
    ).data,
  );

  imprimir("7. conectar", (await bridge.connectNodes({ source: uniqueLector, target: uniqueEscritor })).data);
  imprimir("8. nodos del job", (await bridge.listNodes()).data);
}
