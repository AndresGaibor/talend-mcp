# Los 50 componentes principales: cómo configurarlos

[Volver al índice](PLAN-DE-PRUEBAS.md) · Plan: [05-componentes-uno-a-uno.md](plan-de-pruebas/05-componentes-uno-a-uno.md) · Estado: [06-seguimiento-componentes.md](plan-de-pruebas/06-seguimiento-componentes.md)

Cada ficha sale de lo que devuelve `talend_components_definition` (lo que tú pones y lo que ya tiene valor) y de los escenarios L5 del repo, que son el ejemplo ejecutable. Un escenario marcado como **pendiente** no se puede dar por bueno todavía, y ninguno de los 50 está validado en Talend 8.0.1: el estado real está en el seguimiento.

## Grupo A · flujo de datos basico

### 1. tMap

- **Para qué:** Transformar, filtrar y cruzar entradas y salidas.
- **Configuración:** Tú pones: TEMPORARY_DATA_DIRECTORY. Ya tiene valor, no hace falta tocarlo: ROWS_BUFFER_SIZE.
- **Ejemplo ejecutable:** `transformaciones/un-tmap-renombra-y-filtra.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 2. tFileInputDelimited

- **Para qué:** Leer CSV/TXT.
- **Configuración:** Tú pones: SCHEMA, FILENAME. Ya tiene valor, no hace falta tocarlo: CSV_OPTION, FIELDSEPARATOR, REMOVE_EMPTY_ROW, ADVANCED_SEPARATOR, RANDOM, ENCODING, SPLITRECORD, ROWSEPARATOR. Hay 9 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/leer-un-csv-y-escribir-otro.json`, `archivos/leer-un-csv-y-volcarlo-al-log.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 3. tFileOutputDelimited

- **Para qué:** Escribir CSV/TXT.
- **Configuración:** Tú pones: FILENAME, SCHEMA. Ya tiene valor, no hace falta tocarlo: APPEND, ADVANCED_SEPARATOR, CSV_OPTION, CREATE, SPLIT, FLUSHONROW, ROW_MODE, ENCODING, DELETE_EMPTYFILE, FILE_EXIST_EXCEPTION. Hay 6 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/leer-un-csv-y-escribir-otro.json`, `conciliacion/el-destino-pierde-filas-y-la-conciliacion-falla.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 4. tJDBCInput

- **Para qué:** Leer de una base por JDBC.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbcconnection-comparte-la-conexion.json`, `bd/tjdbcinput-lee-una-tabla.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 5. tJDBCOutput

- **Para qué:** Escribir en una base por JDBC.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbcoutput-escribe-filas.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 6. tJDBCConnection

- **Para qué:** Conexion compartida a la base.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbccommit-confirma-la-insercion.json`, `bd/tjdbcconnection-comparte-la-conexion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 7. tFilterRow

- **Para qué:** Filtrar filas.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: LOGICAL_OP, USE_ADVANCED.
- **Ejemplo ejecutable:** `conciliacion/el-destino-pierde-filas-y-la-conciliacion-falla.json`, `transformaciones/un-tfilterrow-filtra-por-una-condicion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 8. tAggregateRow

- **Para qué:** Agrupar y agregar.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: USE_FINANCIAL_PRECISION, CHECK_TYPE_OVERFLOW, CHECK_ULP.
- **Ejemplo ejecutable:** `transformaciones/agregar-por-ciudad.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 9. tSortRow

- **Para qué:** Ordenar.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: EXTERNAL. Hay 3 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `transformaciones/quitar-duplicados.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 10. tUniqRow

- **Para qué:** Quitar duplicados.
- **Configuración:** Tú pones: SCHEMA, UNIQUE_KEY. Ya tiene valor, no hace falta tocarlo: IS_VIRTUAL_COMPONENT. Hay 1 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `transformaciones/quitar-duplicados.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 11. tJava

- **Para qué:** Codigo Java en lote.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto. Ya tiene valor, no hace falta tocarlo: CODE.
- **Ejemplo ejecutable:** `archivos/borrar-un-fichero-en-ftp.json`, `archivos/comprobar-la-existencia-de-un-fichero-local.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 12. tLogRow

- **Para qué:** Mostrar filas en consola.
- **Configuración:** Tú pones: SCHEMA. Hay 2 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/extraer-campos-de-registros-con-expresion-regular.json`, `archivos/leer-movimientos-bancarios-desde-xml.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

## Grupo B · control y orquestacion

### 13. tRunJob

- **Para qué:** Llamar a un job hijo.
- **Configuración:** Tú pones: SCHEMA, PROCESS. Ya tiene valor, no hace falta tocarlo: PROPAGATE_CHILD_RESULT, PRINT_PARAMETER, USE_BASE64. Hay 5 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `control/reintento-tras-un-fallo-con-espera.json`, `orquestacion/un-job-padre-llama-a-un-job-hijo.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 14. tPrejob

- **Para qué:** Inicio de subjob.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto.
- **Ejemplo ejecutable:** `control/un-tprejob-y-un-tpostjob.json`, `orquestacion/un-job-padre-llama-a-un-job-hijo.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 15. tPostjob

- **Para qué:** Cierre de subjob.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto.
- **Ejemplo ejecutable:** `control/un-tprejob-y-un-tpostjob.json`, `orquestacion/un-job-padre-llama-a-un-job-hijo.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 16. tDie

- **Para qué:** Parar el job con error.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto. Ya tiene valor, no hace falta tocarlo: EXIT_JVM.
- **Ejemplo ejecutable:** `control/correo-de-error.json`, `control/un-tdie-corta-el-job.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 17. tWarn

- **Para qué:** Aviso sin parar.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto.
- **Ejemplo ejecutable:** `control/capturar-aviso-con-tlogcatcher.json`, `control/un-twarn-avisa-y-el-job-sigue.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 18. tLogCatcher

- **Para qué:** Capturar excepciones.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: CATCH_JAVA_EXCEPTION, CATCH_TDIE, CATCH_TWARN, CATCH_TACTIONFAILURE.
- **Ejemplo ejecutable:** `control/capturar-aviso-con-tlogcatcher.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 19. tStatCatcher

- **Para qué:** Estadisticas de ejecucion.
- **Configuración:** Tú pones: SCHEMA.
- **Ejemplo ejecutable:** `control/capturar-estadisticas-con-tstatcatcher.json` (**pendiente**: Sin validar en Studio: falta saber en que linea del log sale el evento de tStatCatcher (los campos son moment, pid, job, message_type, message).
- **Validado en Studio:** no todavía (ver seguimiento).

### 20. tSetGlobalVar

- **Para qué:** Variables globales.
- **Configuración:** Tú pones: VARIABLES.
- **Ejemplo ejecutable:** `codigo/guardar-y-leer-una-variable-global.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 21. tContextLoad

- **Para qué:** Cargar contextos.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: PRINT_OPERATIONS, DISABLE_ERROR, DISABLE_WARNINGS, DISABLE_INFO, DIEONERROR.
- **Ejemplo ejecutable:** `contextos/cada-entorno-tiene-su-valor.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 22. tLoop

- **Para qué:** Bucles FOR/WHILE.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto.
- **Ejemplo ejecutable:** `control/tloop-repite-un-subjob.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

## Grupo C · archivos y formatos

### 23. tFileList

- **Para qué:** Listar ficheros de una carpeta.
- **Configuración:** Tú pones: DIRECTORY.
- **Ejemplo ejecutable:** `archivos/listar-los-ficheros-de-una-carpeta.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 24. tFileInputExcel

- **Para qué:** Leer Excel.
- **Configuración:** Tú pones: FILENAME, SHEETLIST, SCHEMA. Ya tiene valor, no hace falta tocarlo: VERSION_2007, ALL_SHEETS, ADVANCED_SEPARATOR, ENCODING, READ_REAL_VALUE, FORMAT_DATE_CELLS, STOPREAD_ON_EMPTYROW, NOVALIDATE_ON_CELL, SUPPRESS_WARN. Hay 4 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `formatos/escribir-y-releer-un-libro-excel-97-2003.json`, `formatos/leer-productos-desde-un-xlsx.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 25. tFileOutputExcel

- **Para qué:** Escribir Excel.
- **Configuración:** Tú pones: FILENAME, PASSWORD, SCHEMA. Ya tiene valor, no hace falta tocarlo: VERSION_2007, IS_ALL_AUTO_SZIE, CREATE, ADVANCED_SEPARATOR, ENCODING, DELETE_EMPTYFILE. Hay 8 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `formatos/escribir-y-releer-un-libro-excel-97-2003.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 26. tFileInputXML

- **Para qué:** Leer XML.
- **Configuración:** Tú pones: SCHEMA, FILENAME, MAPPING. Ya tiene valor, no hace falta tocarlo: ADVANCED_SEPARATOR, ENCODING. Hay 5 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/leer-movimientos-bancarios-desde-xml.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 27. tFileInputJSON

- **Para qué:** Leer JSON.
- **Configuración:** Tú pones: SCHEMA, FILENAME. Ya tiene valor, no hace falta tocarlo: USEURL, ADVANCED_SEPARATOR, ENCODING. Hay 6 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/leer-un-json.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 28. tFileInputPositional

- **Para qué:** Leer ancho fijo.
- **Configuración:** Tú pones: FILENAME, SCHEMA. Ya tiene valor, no hace falta tocarlo: ADVANCED_OPTION, REMOVE_EMPTY_ROW, PROCESS_LONG_ROW, ADVANCED_SEPARATOR, ENCODING. Hay 5 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `formatos/leer-registros-de-ancho-fijo.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 29. tFileCopy

- **Para qué:** Copiar ficheros.
- **Configuración:** Tú pones: FILENAME, DESTINATION. Ya tiene valor, no hace falta tocarlo: RENAME, REMOVE_FILE, REPLACE_FILE, CREATE_DIRECTORY, PRESERVE_LAST_MODIFIED_TIME. Hay 3 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/copiar-un-fichero-local-y-comprobar-su-contenido.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 30. tFileDelete

- **Para qué:** Borrar ficheros.
- **Configuración:** Tú pones: FILENAME.
- **Ejemplo ejecutable:** `control/tfiledelete-borra-un-fichero.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 31. tFileExist

- **Para qué:** Comprobar que existe un fichero.
- **Configuración:** Tú pones: FILE_NAME.
- **Ejemplo ejecutable:** `archivos/comprobar-la-existencia-de-un-fichero-local.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 32. tHttpRequest

- **Para qué:** Llamadas HTTP/REST.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `sistema/llamar-un-servicio-http-con-thttprequest.json` (**pendiente**: Falta un servidor HTTP de pruebas en el arnes (como smtp-sink para el correo)).
- **Validado en Studio:** no todavía (ver seguimiento).

### 33. tSendMail

- **Para qué:** Enviar correo.
- **Configuración:** Tú pones: MESSAGE. Ya tiene valor, no hace falta tocarlo: TO, FROM, NEED_PERSONAL_NAME, SUBJECT, CHECK_ATTACHMENT, SMTP_HOST, SMTP_PORT, SSL, STARTTLS, DIE_ON_ERROR, TEXT_SUBTYPE, ENCODING, SET_LOCALHOST. Hay 6 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `control/correo-de-error.json`, `control/correo-de-inicio-y-fin.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

## Grupo D · transformacion avanzada

### 34. tJavaRow

- **Para qué:** Codigo Java fila a fila.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: CODE.
- **Ejemplo ejecutable:** `archivos/listar-los-ficheros-de-una-carpeta.json`, `codigo/guardar-y-leer-una-variable-global.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 35. tJavaFlex

- **Para qué:** Java al inicio, por fila y al final.
- **Configuración:** Tú pones: SCHEMA.
- **Ejemplo ejecutable:** `codigo/transformar-filas-con-tjavaflex.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 36. tJoin

- **Para qué:** Cruzar flujos.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: USE_LOOKUP_COLS, USE_INNER_JOIN. Hay 1 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `transformaciones/unir-flujo-principal-y-lookup.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 37. tUnite

- **Para qué:** Unir flujos.
- **Configuración:** Tú pones: SCHEMA.
- **Ejemplo ejecutable:** `transformaciones/un-tunite-junta-dos-flujos.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 38. tReplicate

- **Para qué:** Duplicar un flujo.
- **Configuración:** Tú pones: SCHEMA.
- **Ejemplo ejecutable:** `transformaciones/replicar-filas-a-dos-salidas.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 39. tNormalize

- **Para qué:** Separar una columna en filas.
- **Configuración:** Tú pones: SCHEMA, NORMALIZE_COLUMN. Ya tiene valor, no hace falta tocarlo: CSV_OPTION.
- **Ejemplo ejecutable:** `transformaciones/un-tnormalize-parte-una-columna-en-filas.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 40. tDenormalize

- **Para qué:** Agrupar filas en una columna.
- **Configuración:** Tú pones: SCHEMA. Ya tiene valor, no hace falta tocarlo: NULL_AS_EMPTY.
- **Ejemplo ejecutable:** `transformaciones/agrupar-valores-con-tdenormalize.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 41. tConvertType

- **Para qué:** Cambiar tipos.
- **Configuración:** Tú pones: IN_SCHEMA. Hay 1 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `transformaciones/convertir-tipos-con-tconverttype.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 42. tFlowToIterate

- **Para qué:** Convertir flujo en iteraciones.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto. Ya tiene valor, no hace falta tocarlo: DEFAULT_MAP.
- **Ejemplo ejecutable:** `control/convertir-filas-en-iteraciones.json`, `transformaciones/15-vueltas-de-500-mil-filas-acumuladas-en-un-fichero.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 43. tIterateToFlow

- **Para qué:** Convertir iteraciones en flujo.
- **Configuración:** Tú pones: SCHEMA, MAPPING.
- **Ejemplo ejecutable:** `transformaciones/iterar-y-volver-a-flujo-con-titeratetoflow.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

## Grupo E · bases de datos y utilidades

### 44. tJDBCRow

- **Para qué:** SQL libre.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbccommit-confirma-la-insercion.json`, `bd/tjdbcrollback-deshace-la-insercion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 45. tJDBCClose

- **Para qué:** Cerrar conexion.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbcconnection-comparte-la-conexion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 46. tJDBCCommit

- **Para qué:** Confirmar transaccion.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbccommit-confirma-la-insercion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 47. tJDBCRollback

- **Para qué:** Deshacer transaccion.
- **Configuración:** sin definición XML en la instalación. Los parámetros salen de `talend_studio_component_parameters` (con Studio abierto).
- **Ejemplo ejecutable:** `bd/tjdbcrollback-deshace-la-insercion.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 48. tFixedFlowInput

- **Para qué:** Datos fijos de prueba.
- **Configuración:** Tú pones: SCHEMA, VALUES. Ya tiene valor, no hace falta tocarlo: USE_SINGLEMODE, USE_INTABLE, USE_INLINECONTENT, NB_ROWS. Hay 4 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `archivos/escribir-un-json.json`, `archivos/listar-los-ficheros-de-una-carpeta.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 49. tRowGenerator

- **Para qué:** Generar filas.
- **Configuración:** Tú pones: nada obligatorio, todo tiene valor por defecto. Hay 1 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `transformaciones/generar-filas-con-un-trowgenerator.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

### 50. tPostgresqlInput

- **Para qué:** Leer PostgreSQL.
- **Configuración:** Tú pones: PASS, QUERY. Ya tiene valor, no hace falta tocarlo: HOST, PORT, DBNAME, USER, SPECIFY_DATASOURCE_ALIAS. Hay 3 obligatorio(s) más que están ocultos o dependen de otros parámetros: ignóralos.
- **Ejemplo ejecutable:** `bd/leer-de-un-postgres.json`.
- **Validado en Studio:** no todavía (ver seguimiento).

