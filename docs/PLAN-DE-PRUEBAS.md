# Plan de pruebas del MCP de Talend

Va de lo simple a lo complejo. Si una fase falla, no avances: ahi esta el limite del MCP.
Como usar el MCP para ejecutarlo: [GUIA-AGENTE.md](GUIA-AGENTE.md).

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

Para las pruebas de base de datos: `testdata/docker-compose.yml` y `testdata/sql/init.sql`
levantan un Postgres local. El proyecto real ya tiene un Postgres en la nube configurado en sus
jobs, asi que Docker solo hace falta si no se quiere tocar ese.

## Fases y estado

| Fase | Que se prueba | Estado |
|---|---|---|
| 0 | `tFixedFlowInput` -> `tLogRow` (humo) | Validada: `1\|Bogota\|100.5`, `2\|Medellin\|200.25` |
| 1 | `tFileInputDelimited` -> `tLogRow`; -> `tFileOutputDelimited` (separador y encoding) | Validada: respeta tildes, ñ y nulos; falla en fechas `dd/MM/yyyy` (la trampa); salida UTF-8 correcta |
| 2 | `tMap` (renombrar, expresiones, filtros, rechazo, lookups, nulos, fechas, Var) | **Bloqueada por entorno**: el `.item` sale bien pero no compila sin `talend-tmap-dataset-1.2.16.jar` (Talend Exchange) |
| 3 | `tSortRow`, `tUniqRow`, `tAggregateRow`, `tJoin`, `tUnite`, `tReplicate`, `tNormalize`, `tDenormalize`, `tFilterRow`, `tFilterColumns` | **Parcial**: el `.item` sale bien, sus tablas se rellenan con el plan (columnas y valores por defecto del XML) y **compilan**; falta la fila real (que condicion poner) y probarlos con datos. El `tUniqRow` ademas exige el conector `UNIQUE` (no `FLOW`) y el nombre de la conexion en la tabla (`row1.id`) |
| 4 | `tConvertType`, `tJavaRow`, `tJava`, `tJavaFlex` | Validada con `tJavaRow` (acumulado tipo `RETAIN`) |
| 5 | Excel, posicional, JSON, Parquet | **Bloqueada**: `tFileInputPositional` y `tFileInputJSON` generan codigo que no compila en 8.0.1; el `.item` es correcto |
| 6 | `tPrejob`/`tPostjob`, `tRunJob` padre-hijo, contextos, `tFileList`, triggers, `tDie`/`tWarn` | Validada en lo probado: `tPrejob`/`tPostjob`/`tRunJob` (el padre llama al hijo). Sin probar: `tFileList`, triggers de error, `tDie` |
| 7 | Bases de datos (`tDB*`, commit/rollback, insert/update/delete) | **Pendiente** |
| 8 | Migracion de un programa SAS real, comparado fila por fila | **Pendiente** |
| 9 | Robustez | Validada: componente inexistente da error claro; repetir la instruccion no duplica componentes; 16 componentes y 60 columnas |

Orden recomendado para lo que falta: terminar la 3 (descubrir el formato de las tablas con
`talend_studio_component_parameters`), la 6 completa, luego 7 y 8.

## Plantilla de resultados

`testdata/resultados.csv`, una fila por prueba:
`fase, prueba, prompt_usado, genera_ok, abre_ok, ejecuta_ok, salida_correcta, tiempo_min, notas`

## Cobertura del catalogo

`bun run scripts/coverage.ts` crea, configura, **monta**, compila y borra cada componente **Standard (DI)** del catalogo
(897 componentes unicos; las 397 variantes de Spark y Streaming solo valen en jobs de ese tipo, ver INTERNALS 29) en
un job de pruebas (`MCP_Coverage`) y escribe `testdata/cobertura.csv`. Tarda ~5 min: arranca en el bridge y
consulta el progreso (una peticion HTTP unica la cortaria el cliente a los 5 min). Opciones: `--filter`, `--family`,
`--components`, `--max`, `--compile` (nivel L4), `--cancel`. Tras cada fallo el job de pruebas se reinicia, para
que un componente roto no contamine a los siguientes. `bun run scripts/coverage-summary.ts` agrupa los fallos.

**"Montar" es lo que hace que la medicion valga**: cada componente se mide dentro de un job minimo (un
`tFixedFlowInput` con schema si consume, un `tLogRow` si el generador lo pide) y con sus parametros obligatorios
rellenados segun el XML de la instalacion (ver INTERNALS 30). Sin eso, la mitad de los componentes no compila
por falta de un `FILENAME` o por no tener a donde conectar.

**Medicion L1/L2 (Talend 8.0.1):** 877 de 897 componentes Standard (98 %) pasan creacion, configuracion de
parametros, guardado en el `.item`, presencia en el job y borrado. Fallan 20, todos por la misma causa:

| Causa | Componentes | Que significa |
|---|---|---|
| `ArtifactResolutionException`: falta `org.talend.components:components-jdbc-runtime:0.37.61` | 20 (Athena, Databricks SQL, Delta, Single Store...) | Studio no encuentra el runtime de estos componentes; no esta en Maven Central ni en el Nexus publico de Talend |

(Una medicion anterior daba 96 % de 1294 con 29 fallos "de Spark": mezclaba las variantes de Spark con las de
Standard; ver INTERNALS 29.)

**L3 y L4 (conectar y compilar)**, con el metodo viejo (sin montaje ni parametros obligatorios): 66 de 75
compilaban (88 %), y los 9 que no compilaban fallaban todos por lo mismo, "Missing output connection for component
X": son componentes de entrada de la generacion nueva (JDBC, Snowflake, DynamoDB, SQS) que no declaran sus
conectores en el modelo y exigen tener una conexion de salida.

Con el metodo nuevo (montaje + parametros del XML) las muestras dan:

| Muestra | Antes | Ahora |
|---|---|---|
| `tFileOutputDelimited` | No compilaba (`The constructor File() is undefined`) | Compila |
| `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` | No compilaban (el origen no traia el schema fijo del componente) | Compilan |
| `tFileOutputPositional` | No compilaba (`Syntax error on token '<'`: la tabla `FORMATS` sin filas) | Compila |
| `tFilterRow`, `tSortRow`, `tAggregateRow` | "El `.item` sale, no genera codigo" | Compilan |
| `JDBCInput` | `Missing output connection` | Compila |

Lo que queda como limite del entorno (no del MCP): `tFileInputARFF`, `tFileInputXML` y `tFileOutputARFF` estan
escritos para otra version de Weka; `tFileInputMSXML` genera codigo con una llave sin cerrar; los componentes de
base de datos necesitan una conexion real del repositorio.

Esto es L1/L2/L3/L4 (ver [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md)): que el componente exista,
acepte configuracion, se pueda conectar y compile. **No** dice que ejecute bien: eso es L5, y solo esta validado
a mano en unos 8 componentes.

## Ejecucion con la salida esperada (L5)

`bun run scripts/execution-check.ts` monta cada escenario de `tests/fixtures/talend/escenarios-l5.json`, lo ejecuta
y **compara la salida con la que se declaro antes de ejecutar** (lineas exactas, lineas que tienen que aparecer o
el fichero que escribe). El informe queda en `testdata/resultados-l5.csv`.

| Escenario | Estado |
|---|---|
| `tFixedFlowInput` -> `tLogRow` | Correcto: `1\|Bogota`, `2\|Medellin` |
| `tFileInputDelimited` -> `tLogRow` | Correcto: las cuatro filas, con el separador y los decimales tal cual |
| `tFileInputDelimited` -> `tFileOutputDelimited` | Correcto: el fichero escrito tiene las cuatro filas |
| `tUniqRow` (quitar duplicados) | **Pendiente**: el codigo generado lee una columna suelta en vez de la de la conexion de entrada |

Los pasos para ejecutar y leer la salida estan en INTERNALS 33: primero el Run de Studio (que genera y compila),
despues el relanzamiento que devuelve las lineas.
