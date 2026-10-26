# Criterios, datos y fases

[Volver al indice](../PLAN-DE-PRUEBAS.md)

## Criterios (se registran para cada prueba)

1. El MCP genera el job sin errores.
2. El job abre en Talend Studio sin avisos.
3. El job compila y ejecuta.
4. La salida coincide con lo esperado, **que se define antes de ejecutar**.

La salida se lee con `talend_job_execute`, no mirando la vista Run.

## Datos de prueba

`bun run scripts/make-testdata.ts` los genera en `testdata/` (los CSV y el Excel grandes estan
en `.gitignore` y se regeneran). Tienen trampas a proposito.

| Archivo | Contenido | Trampas |
|---|---|---|
| `clientes.csv` | id, nombre, fecha_alta, monto, estado, ciudad | Separador `;`, tildes y ñ, nulos, 2 filas duplicadas, fechas en dos formatos |
| `transacciones.csv` | id_tx, id_cliente, monto, fecha | Un `id_cliente` que no existe en clientes (rechazos) |
| `productos.xlsx` | 2 hojas, encabezado en la fila 3 | Celdas combinadas, numeros guardados como texto |
| `ancho_fijo.txt` | Layout posicional de 5 campos | Estilo de exportes SAS |
| `config.json` / `ventas.json` | Parametros anidados | Arreglo dentro de objeto |
| `clientes_grande.csv` | 500 mil filas | Rendimiento |
| `l5_clientes.csv` / `l5_ventas.csv` | Los CSV de los escenarios L5: `id;nombre;ciudad;monto` y `ciudad;monto;cliente`. El `l5_ventas.csv` no lo genera `make-testdata.ts` | El de ventas tiene **tres columnas** porque el generador del `tFileInputDelimited` exige que el numero de columnas del origen sea el mismo que el de la salida del destino |

Para las pruebas de base de datos: `testdata/docker-compose.yml` y `testdata/sql/init.sql`
levantan un Postgres local. El proyecto real ya tiene un Postgres en la nube configurado en sus
jobs, asi que Docker solo hace falta si no se quiere tocar ese.

## Fases y estado

| Fase | Que se prueba | Estado |
|---|---|---|
| 0 | `tFixedFlowInput` -> `tLogRow` (humo) | Validada: `1\|Bogota\|100.5`, `2\|Medellin\|200.25` |
| 1 | `tFileInputDelimited` -> `tLogRow`; -> `tFileOutputDelimited` (separador y encoding) | Validada: respeta tildes, ñ y nulos; falla en fechas `dd/MM/yyyy` (la trampa); salida UTF-8 correcta |
| 2 | `tMap` (renombrar, expresiones, filtros, rechazo, lookups, nulos, fechas, Var) | **Validada en L5**: el modelo del mapper (entradas, salidas con expresiones, filtro) se monta con el `mapper` del bridge, el job compila y ejecuta. El `talend-tmap-dataset` del Exchange solo hace falta para el editor visual, no para generar codigo ni para ejecutar |
| 3 | `tSortRow`, `tUniqRow`, `tAggregateRow`, `tJoin`, `tUnite`, `tReplicate`, `tNormalize`, `tDenormalize`, `tFilterRow`, `tFilterColumns` | **Parcial**: el `.item` sale bien, sus tablas se rellenan con el plan (columnas y valores por defecto del XML) y **compilan**. **Se ejecutan bien** el `tUniqRow`, el `tSortRow`, el `tFilterRow` (con su condicion), el `tUnite`, el `tAggregateRow` (con sus tablas `GROUPBYS` y `OPERATIONS`; ver INTERNALS 41), el `tNormalize` (entrada y salida declaran columnas con el mismo nombre), `tJoin` (flujo principal unido a lookup por clave; ver INTERNALS 46), `tReplicate` (dos salidas reciben las filas) y `tDenormalize` (concatena `producto` dentro de cada grupo). `tFilterColumns` ya tiene escenario L5. |
| 4 | `tConvertType`, `tJavaRow`, `tJava`, `tJavaFlex` | Validada con `tJavaRow` (acumulado tipo `RETAIN`), con `tJavaRow` cuya salida la define el parametro `SCHEMA`, con `tJava` y con `tJavaFlex` (transforma filas; escenarios L5). |
| 5 | Excel, posicional, JSON, XML, regex, Parquet | **Parcial en L5**: `tFileOutputExcel` y `tFileInputExcel` completan ida y vuelta `.xls` 97-2003; la lectura XLSX queda pendiente porque a este Studio le faltan modulos de Apache POI. La lectura/escritura JSON funcionan; posicional lee y escribe con formato exacto. Añadidos y validados: `tFileInputRaw` como texto completo, `tFileInputRegex` con cuatro grupos y `tFileInputXML` con XPath y dos movimientos. Ver COBERTURA-POR-FAMILIA. |
| 6 | `tPrejob`/`tPostjob`, `tRunJob` padre-hijo, contextos, `tFileList`, triggers, `tDie`/`tWarn`, `tFlowToIterate`, `tSetGlobalVar`, `tSetEnv`, `tSystem`, `tLogCatcher` | Validada: el padre llama al hijo y la salida del hijo sale en la del padre (escenario del arnes), el `tFileList` lista la carpeta (no emite filas: deja los valores en el `globalMap`; ver INTERNALS 47), el `tDie` corta el job con codigo 1, un trigger de error (`SUBJOB_ERROR` desde el arranque del subjob) ejecuta su manejador, `tPrejob`/`tPostjob` corren antes y despues del subjob principal, `tWarn` avisa sin cortar el job, `tLogCatcher` captura su mensaje, `tFlowToIterate` convierte dos filas en dos iteraciones, `tSetGlobalVar` permite leer una variable global, `tSetEnv` establecer/leer una propiedad del job y `tSystem` ejecutar un comando local y emitir su salida normal. `tContextLoad` recibe filas `key/value`, carga `L5_VALOR` y confirma la operacion con `PRINT_OPERATIONS`. Un trigger se genera solo si sale del **arranque** del subjob (INTERNALS 53). El `PRIORITY` del `tWarn` va con su `VALUE` (`4`), no con el nombre `WARNING` (INTERNALS 57) |
| 10 | Privacidad (`tDataMasking`, `tDataEncrypt`, `tDataDecrypt`, `tDuplicateRow`, `tDataShuffling`) | **Validada en L5**: `SET_TO_NULL` sobre `cuenta` produce cadena vacia y `ORIGINAL_MARK=false`; el ciclo de cifrado/descifrado AES recupera el valor original; `tDuplicateRow` emite copias marcadas y conserva las originales; `tDataShuffling` procesa cuatro valores con semilla fija y conserva sus filas. Los enums de `MODIF_TABLE` y los nombres de columnas de shuffling se configuran sin comillas Java; ver INTERNALS 46. |
| 11 | Data Quality/Standardization (`tStandardizePhoneNumber`, `tSynonymOutput`, `tSynonymSearch`, `tFirstnameMatch`) | **Parcial en L5**: `tStandardizePhoneNumber` normaliza a E.164; `tSynonymOutput` crea un índice Lucene local y `tSynonymSearch` recupera un sinónimo de ese índice; `tFirstnameMatch` sigue pendiente porque falta el módulo local `org.talend.dataquality.data.index-8.0.1-Talend_v20260630-1613.jar`. La búsqueda depende del índice que genera el escenario de salida. |
| 12 | File Management (`tFileTouch`, `tFileExist`, `tFileCopy`, `tFileProperties`, `tFileUnarchive`) | **Validados en L5**: `tFileTouch` crea un archivo vacío; `tFileExist` detecta un fichero local y un `tJava` verifica el booleano publicado en `globalMap`; `tFileCopy` copia el archivo a otro nombre y se validan contenido y conservación de la fuente; `tFileProperties` emite el nombre y tamaño esperados; `tFileUnarchive` extrae entradas ZIP y se verifica el contenido extraído. |
| 13 | AWS (S3, SQS y DynamoDB) | **Parcial en L5 contra Moto**: pasan `S3BucketCreate`, `S3BucketExist`, `S3Put`, `S3Get`, `S3Copy`, `S3Delete`, `S3BucketDelete`, `SQSQueueCreate` y `SQSQueueDelete`; Moto tambien valida la API DynamoDB por separado. `dynamoDBOutput` y `SQSOutput` fallan al inicializar `stream-json` en Java 21; `SQSQueueAttributes` falla al mapear el esquema y `SQSQueuePurge` alcanza el limite temporal de Moto. Athena no ejecuta SQL en Moto y el job Talend sigue bloqueado por `components-jdbc-runtime:0.37.61`. Azure Blob no esta en la paleta DI. |
| 7 | Bases de datos (`tDB*`, commit/rollback, insert/update/delete) | **Postgres esencial validado en L5**: `tPostgresqlInput` lee; `tPostgresqlOutput` inserta y verifica, actualiza con clave (`UPDATE_KEY`), hace commit explícito y borra con clave (`DELETE_KEY`); `tPostgresqlRollback` conserva el valor previo. `INSERT_OR_UPDATE` fue probado con una fila existente y otra nueva, verificando actualización e inserción. Quedan otras acciones de tabla y familias de base de datos por probar. |
| 8 | Migracion de un programa SAS real, comparado fila por fila | **Pendiente** |
| 9 | Robustez | Validada: componente inexistente da error claro; repetir la instruccion no duplica componentes; 16 componentes y 60 columnas |

Orden recomendado para lo que falta: la 8 (la migracion de SAS).

## Plantilla de resultados

`testdata/resultados.csv`, una fila por prueba:
`fase, prueba, prompt_usado, genera_ok, abre_ok, ejecuta_ok, salida_correcta, tiempo_min, notas`
