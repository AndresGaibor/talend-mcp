# Seguimiento de los 50 componentes

[Volver al indice](../PLAN-DE-PRUEBAS.md) · Plan y criterios: [05-componentes-uno-a-uno.md](05-componentes-uno-a-uno.md)

Leyenda: ⬜ pendiente · 🟡 en curso · ✅ pasa · ❌ falla (ver nota) · ➖ no aplica.

Cada columna es una comprobacion de la ficha (C1 a C8). C9 (agente frio) se anota por grupo, al final de la tabla.
Las notas dicen solo lo que ya esta medido en los informes `testdata/cobertura-l4-*.csv` y en los escenarios L5. No
son resultados de la revision: cada componente se revisa desde cero.

## Registro

| Fecha | Componente | Comprobacion | Comando o herramienta | Resultado |
|---|---|---|---|---|
| 2026-10-26 | Bridge | Fase 0 | `bun run bridge:install` (carga en caliente) | Publicado. El build en vivo coincide con el local (`bridge:status`). |
| 2026-10-26 | Lista de 50 | Verificacion de nombres | `talend_studio_list_components`, `talend_components_definition` | Corregidos 8 nombres que no existen en Studio 8.0.1 (tDB* y tRESTClient). |
| 2026-10-26 | Todos (L4) | Medicion de compilacion | `bun run scripts/coverage.ts --components ... --compile` | Cancelada: heap de Studio al 89-93%. Pendiente tras liberar memoria. |
| 2026-10-26 | Todos (C1, C2) | Descubrimiento y configuracion | `talend_components_definition` (42 XML) | Texto para el agente reescrito: separa lo que pone quien llama de lo que ya tiene valor. 10 tests. |
| 2026-10-26 | Todos (C3) | Contrato generico | `talend_components_parameters` | Acepta `name` ademas de `componentName`; error que dice que falta. |
| 2026-10-26 | Todos (C5, C6) | Ejecucion L5 por suites | `scripts/execution-check.ts --suite <s> --todas` | Lote parado a mitad (memoria del sistema critica). Estado derivado de `testdata/resultados-l5.csv`: 28 componentes OK, 14 con fallo, 8 pendientes. Los fallos "no termino a tiempo" se separan de los que tienen causa. |
| 2026-10-26 | Todos (C5, C6) | Parada del lote y reinicio de Studio | `Stop-Process` por PID de los procesos del lote; `CloseMainWindow` de Studio | Lote parado en la suite `control` (colgado y sin memoria). Studio cerrado sin guardar nada pendiente y reabierto; el bridge responde en `0.1.0.202610262156`. Pendiente: repetir los fallidos con poca memoria. |
| 2026-10-26 | tPostgresqlRow, tPostgresqlClose | C5, C6 | `execution-check --todas tPostgresqlRow` | Pasan en Talend tras quitar el disparador desde la conexion y el relanzamiento doble del arnes. |
| 2026-10-26 | tJDBC* | C5 | `talend_job_compile` con `installMissing` | Bloqueado: `components-jdbc-runtime` no esta en repositorios publicos. Escenarios marcados pendientes. |
| 2026-10-26 | tJDBC*, tHttpRequest | C2 | `talend_studio_component_parameters` | Bloqueado: el hilo de Studio no responde y hay un dialogo "Network Issue" abierto. |
| 2026-10-27 | tOracle* (Connection, Input, Output, Row, Close, Commit, Rollback, TableList) | C5, C6 | `execution-check --suite bd` (Oracle 23 Free, driver 19.19) | Pasan 10 escenarios en Talend: leer, escribir, actualizar con commit, borrar, rollback, Row, upsert, close, TableList y contrasena incorrecta. |
| 2026-10-27 | tMSSql* (Connection, Input, Output, Row, Close, Commit, Rollback, TableList) | C5, C6 | `execution-check --suite bd` (SQL Server 2022) | Pasan 9 escenarios. Requiere `trustServerCertificate` y `PORT` literal. Pendiente: tMSSqlColumnList (salida FLOW vacia). |
| 2026-10-27 | tDB2* (Connection, Input, Output, Row, Close, Commit, Rollback, SP) | C5, C6 | `execution-check --suite bd` (Db2 Community, base TALEND) | Pasan 11 escenarios, incluido tDB2SP. Requiere registrar db2jcc4 y las licencias por bridge y reiniciar Studio. |
| 2026-10-27 | tFileRowCount, tFileCompare, tFileInputFullRow, tChangeFileEncoding, tCreateTemporaryFile, tFileOutputRaw | C5, C6 | `execution-check --suite archivos` | Pasan. tFileOutputRaw sobrescribe por fila: queda la ultima. |
| 2026-10-27 | tFileInputProperties, tFileOutputProperties, tFileInputLDIF, tFileOutputLDIF, tFileInputARFF, tFileArchive, tFileUnarchive | C5, C6 | `execution-check --suite archivos` | Pasan. tFileArchive necesita una carpeta de origen (con un fichero suelto falla). |
| 2026-10-27 | tFileOutputXML, tXSDValidator | C5, C6 | `execution-check --suite archivos` | Pasan. tFileOutputXML: ROOT_TAGS y MAPPING son tablas; SCHEMA_COLUMN_NAME es booleano. |
| 2026-10-27 | tFTPFileExist, tFTPClose, tFTPFileProperties | C5, C6 | `execution-check --suite archivos` (FTP pure-ftpd) | Pasan. tFTPFileProperties: el esquema de salida lo fija el componente. |
| 2026-10-27 | tSocketOutput | C5, C6 | `execution-check --suite archivos` (sumidero `scripts/l5/socket-sink.ts`) | Pasa. Entrecomilla los campos por defecto. |
| 2026-10-27 | tReplace | C5, C6 | `execution-check --suite calidad` | Pasa con la regla en la tabla SUBSTITUTIONS. |
| 2026-10-27 | tREST | C5, C6 | `execution-check --suite apis` (sumidero HTTP `scripts/l5/http-sink.ts`) | Pasa tras registrar JAX-RS y Jersey, `system-routines` y reiniciar Studio. Salida `Body` y `ERROR_CODE`. |
| 2026-10-27 | tFTPTruncate | C5 | `execution-check --suite archivos` | Pendiente: termina sin error pero el fichero remoto conserva su contenido. Sin resolver. |
| 2026-10-27 | tExtractXMLField | C5 | `execution-check --suite archivos` | Pendiente: con USE_XML_FIELD la columna xml llega vacia al componente. |
| 2026-10-27 | tSSH, tSCPPut | C5 | `execution-check --suite archivos` | Pendiente: tSSH no compila contra sshd 2.17.1 (clase sin identificar). tSCPPut necesita talend-scp-helper, que no es publico. |
| 2026-10-27 | tJMSOutput, tJMSInput | C5 | `execution-check --suite mensajeria` (ActiveMQ) | Pendiente: el modo RAW exige un objeto jakarta.jms.Message; el modo CONTENT no compila. |
| 2026-10-27 | tSocketInput | C5 | escenario sin ejecutar | Pendiente: necesita un cliente sincronizado con el arranque del job. |
| 2026-10-27 | tFileOutputARFF, tExternalSortOutput | C5 | `execution-check --suite archivos` | Pendiente: ARFF sin atributos ni filas; sort escribe fichero vacio. |
| 2026-10-27 | tSchemaComplianceCheck | C5 | `execution-check --suite calidad` | Pendiente: la salida REJECT no genera errorCode ni errorMessage en el struct. Causa en el propagado de esquemas del bridge. |
| 2026-10-27 | tReplaceList | C5 | `execution-check --suite calidad` | Pendiente: el conector LOOKUP se genera sin nombre ni esquema (tHash_null). |
| 2026-10-27 | tKafka*, tS3*, tAddCRCRow | C1 | sin definicion en la instalacion de Studio | No se pueden ejecutar aqui: no hay definicion del componente (Kafka, S3) o falta OneWireAPI (tAddCRCRow). |
| 2026-10-27 | tXSLT | C5, C6 | `execution-check --suite calidad` (Saxon-HE 10.6, commons-io 2.20.0) | Pasa con la salida a fichero (OVERRIDE_OUTPUT=false). Con OVERRIDE_OUTPUT=true la salida va a una columna y el job no compila sin ella. |
| 2026-10-27 | tWriteXMLField | C5 | `execution-check --suite calidad` | Pendiente: el codigo generado tiene try/catch desbalanceado (catch sin try) con las tablas ROOT y LOOP. Sin resolver. |
| 2026-10-27 | tAdvancedFileOutputXML | C5 | `execution-check --suite archivos` | Pendiente: usa ROOT, LOOP y MAP; el codigo generado referencia una variable no declarada (nameToElement_tAFOX_2). Mismo patron que tWriteXMLField. |
| 2026-10-27 | tExtractDelimitedFields | C5 | `execution-check --suite archivos` | Pendiente: el generador busca FIELD en la metadata de la conexion de entrada, que conserva las columnas del destino. Reaplicar el esquema del origen no actualiza la conexion. Hace falta refrescarla en el bridge. |
| 2026-10-27 | Bridge: sincronizacion de conexiones de salida | C5 | `set-schema` + `execution-check` (tExtractDelimitedFields) | Probado y revertido: copiar el esquema del origen a sus conexiones de salida (la tabla llega con `linea`) no basta; el generador sigue sin emitir el try. Probablemente una segunda propagacion al persistir el job. Pendiente de investigar en JobPersistence.persist. |
| 2026-10-27 | tMongoDBInput, tMongoDBOutput, tMongoDBConnection, tMongoDBClose | C5, C6 | `execution-check --suite bd` (Mongo 7, auth SCRAM) | Pasan. Los dos escenarios que estaban pendientes pasan al poner la tabla MAPPING (una fila por columna). La marca de cuelgue era consecuencia de ese error de diseno. |
| 2026-10-27 | tMongoDBRow | C5, C6 | `execution-check --suite bd` | Pasa: inserta con un comando JSON (`insert`) y lo lee de vuelta. |
| 2026-10-27 | tMongoDBGridFSPut, tMongoDBGridFSList | C5, C6 | `execution-check --suite bd` | Pasan. GridFSList emite por ITERATE (CURRENT_FILENAME), no por fila. |

## Estado

| # | Componente | Grupo | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | Estado | Notas previas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tMap | A | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: sale con codigo 1 sin salida (causa oculta en stderr: corregido el arnes, repetir). Compila en informes L4 (antes de los cambios de mapper). Bridge con los cambios compila; falta publicarlo. Fixture usa `row2`. |
| 2 | tFileInputDelimited | A | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4. Varios escenarios L5. El validador exige FILENAME y esquema. |
| 3 | tFileOutputDelimited | A | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (3 informes). |
| 4 | tJDBCInput | A | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Sustituye a tDBInput, que no existe en esta Studio. Presente en el catalogo DI. Sin medicion de compilacion. |
| 5 | tJDBCOutput | A | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBOutput. Sin medicion de compilacion. |
| 6 | tJDBCConnection | A | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBConnection. Sin medicion de compilacion. |
| 7 | tFilterRow | A | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (4 informes). Escenario L5 existente. |
| 8 | tAggregateRow | A | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: sale con codigo 1 sin salida (causa oculta en stderr: corregido el arnes, repetir). Compila en L4 (3 informes). Reglas en 04-reglas-de-componentes.md. |
| 9 | tSortRow | A | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Falla en 2 informes (`defaultRow cannot be resolved`) y pasa en 1. |
| 10 | tUniqRow | A | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Falla en 1 informe (`IllegalArgumentException`) y pasa en 2. |
| 11 | tJava | A | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 12 | tLogRow | A | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 13 | tRunJob | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Falla en 3 informes (`Syntax error on token "new"`). Escenario L5 con hijo existe. |
| 14 | tPrejob | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). Escenario tPrejob -> tRunJob -> tPostjob. |
| 15 | tPostjob | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 16 | tDie | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). Escenario con SUBJOB_ERROR existe. |
| 17 | tWarn | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 18 | tLogCatcher | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (3 informes). |
| 19 | tStatCatcher | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Compila en L4 (2 informes). |
| 20 | tSetGlobalVar | B | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (2 informes). |
| 21 | tContextLoad | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Falla en 4 informes (`Duplicate local variable key_tContextLoad_2`). |
| 22 | tLoop | B | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). Escenario de bucle existe. |
| 23 | tFileList | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4. Un fallo del arnes (`duplicated in the reactor`): volver a medir. |
| 24 | tFileInputExcel | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Falla en 3 informes (`Syntax error on token ""`). |
| 25 | tFileOutputExcel | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (3 informes). |
| 26 | tFileInputXML | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Falla en 5 informes (`NameSpaceTool_... cannot be resolved`). Un fallo del arnes: volver a medir. |
| 27 | tFileInputJSON | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (1 informe). Escenario L5 de JSON existe. |
| 28 | tFileInputPositional | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (1 informe). Escenario de ancho fijo existe. |
| 29 | tFileCopy | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Falla en 1 informe (`IllegalArgumentException`). |
| 30 | tFileDelete | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). Un fallo del arnes: volver a medir. |
| 31 | tFileExist | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). Un fallo del arnes: volver a medir. |
| 32 | tHttpRequest | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tRESTClient, que no existe en esta Studio (el REST de la paleta, tREST, esta deprecated). Sin medicion. |
| 33 | tSendMail | C | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Creado y guardado; sin compilacion medida en L4. |
| 34 | tJavaRow | D | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 35 | tJavaFlex | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (3 informes). Escenario de tJavaFlex existe. |
| 36 | tJoin | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (2 informes). |
| 37 | tUnite | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (2 informes). Escenario L5 existe. |
| 38 | tReplicate | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: sale con codigo 1 sin salida (causa oculta en stderr: corregido el arnes, repetir). Compila en L4 (2 informes). Escenario L5 existe. |
| 39 | tNormalize | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: sale con codigo 1 sin salida (causa oculta en stderr: corregido el arnes, repetir). Falla en 2 informes (`split(String`). |
| 40 | tDenormalize | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Falla en 4 informes (`ciudad cannot be resolved`). |
| 41 | tConvertType | D | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (2 informes). |
| 42 | tFlowToIterate | D | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 43 | tIterateToFlow | D | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (2 informes). |
| 44 | tJDBCRow | E | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBRow. Sin medicion de compilacion. |
| 45 | tJDBCClose | E | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBClose. Sin medicion de compilacion. |
| 46 | tJDBCCommit | E | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBCommit. Sin medicion de compilacion. |
| 47 | tJDBCRollback | E | ✅ | 🟡 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | L5: escenario pendiente (ver fixture). Sustituye a tDBRollback. Sin medicion de compilacion. |
| 48 | tFixedFlowInput | E | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (1 informe). Escenario L5 existe. |
| 49 | tRowGenerator | E | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ⬜ | ⬜ | ❌ | L5: el job no termino a tiempo (Studio bloqueado o memoria; no hay causa del componente aun). Compila en L4 (2 informes). Escenario L5 existe. |
| 50 | tPostgresqlInput | E | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ⬜ | ⬜ | 🟡 | L5: pasa en Talend (ultimo informe). Compila en L4 (1 informe). |

## C9 por grupo (agente frio)

| Grupo | Componentes | Agente probado | Llamadas hasta configurar | Errores que encontro | Resultado |
|---|---|---|---|---|---|
| A | 1 a 12 | — | — | — | ⬜ |
| B | 13 a 22 | — | — | — | ⬜ |
| C | 23 a 33 | — | — | — | ⬜ |
| D | 34 a 43 | — | — | — | ⬜ |
| E | 44 a 50 | — | — | — | ⬜ |
