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
| 3 | `tSortRow`, `tUniqRow`, `tAggregateRow`, `tJoin`, `tUnite`, `tReplicate`, `tNormalize`, `tDenormalize`, `tFilterRow`, `tFilterColumns` | **Parcial**: el `.item` sale bien, sus tablas se rellenan con el plan (columnas y valores por defecto del XML) y **compilan**. **Se ejecutan bien** el `tUniqRow`, el `tSortRow`, el `tFilterRow` (con su condicion), el `tUnite` y el `tAggregateRow` (con sus tablas `GROUPBYS` y `OPERATIONS`; ver INTERNALS 41). Sin probar: `tJoin`, `tReplicate`, `tDenormalize`, `tFilterColumns` y el `tNormalize` (ver L5) |
| 4 | `tConvertType`, `tJavaRow`, `tJava`, `tJavaFlex` | Validada con `tJavaRow` (acumulado tipo `RETAIN`). El `tJavaRow` cuya salida la define el parametro `SCHEMA` sigue pendiente (ver L5) |
| 5 | Excel, posicional, JSON, Parquet | **Parcial**: la **escritura** de JSON funciona (el `tFileOutputJSON` escribe las filas). La **lectura** de JSON sigue bloqueada: el pom del job no hereda las librerias que declara el componente (json-simple) y el codigo no compila (`org.json.simple.JSONValue cannot be resolved to a type`); el jar si esta en el `.m2` de Studio, lo que falta es que el build lo anada al pom. `tFileInputPositional`: el `.item` es correcto |
| 6 | `tPrejob`/`tPostjob`, `tRunJob` padre-hijo, contextos, `tFileList`, triggers, `tDie`/`tWarn` | Validada: el padre llama al hijo y la salida del hijo sale en la del padre (escenario del arnes). Sin probar: `tFileList`, `tDie` |
| 7 | Bases de datos (`tDB*`, commit/rollback, insert/update/delete) | **Parcial**: el `tPostgresqlInput` lee del Postgres de pruebas y la salida es la esperada, y el `tPostgresqlOutput` **escribe y se verifica** (con `AUTO_COMMIT=true` en la conexion y **sin** componente de commit; ver INTERNALS 45). Sin probar: el commit/rollback explicito (`tPostgresqlCommit`/`tPostgresqlRollback`) y las demas acciones de salida |
| 8 | Migracion de un programa SAS real, comparado fila por fila | **Pendiente** |
| 9 | Robustez | Validada: componente inexistente da error claro; repetir la instruccion no duplica componentes; 16 componentes y 60 columnas |

Orden recomendado para lo que falta: la 6 completa (`tFileList`, `tDie`), la 7 (el commit/rollback explicito y las
demas acciones de salida), la 5 (la lectura de JSON) y la 8.

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

**Medicion por familias** (con el metodo nuevo: montaje + parametros del XML), 134 componentes de las familias
`File/Input`, `File/Output`, `Processing`, `Processing/Fields`, `Misc`, `Technical`, `Logging_Errors`,
`Orchestration` y `Custom_Code` (15 min):

| | Resultado |
|---|---|
| Se crean, guardan, listan y borran | **134 de 134** |
| Compilan (L4) | **99 de 134 (74 %)** |

**Medicion de los componentes que no piden artefacto**, con `--sin-artefacto`:

| Familias | Componentes | Compilan |
|---|---|---|
| `Logs_Errors`, `XML`, `Data_Quality`, `File/Management`, `PostgreSQL` | 44 | 38 (86 %) |
| `MySQL` | 19 | 19 (100 %) |
| `Data_Quality/Matching`, `Business_Intelligence/DB_SCD`, `MS_SQL_Server`, `Oracle` | 62 | 60 (97 %) |

La **ultima tanda** fueron los 44 componentes locales de la primera fila (`Logs_Errors`, `XML`, `Data_Quality`,
`File/Management`, `PostgreSQL`): **44 de 44 probados, 38 compilan, 0 fallos, 84 s** y el heap de Studio al
**39 %**. La lista de componentes esta en `testdata/componentes-locales.txt` y el detalle de la tanda, en
`testdata/cobertura-l4-locales.csv`:

```bash
bun run scripts/coverage.ts --components $(cat testdata/componentes-locales.txt) --compile --out testdata/cobertura-l4-locales.csv
```

En PowerShell, el `--components` se pasa con el contenido del fichero:

```powershell
bun run scripts/coverage.ts --components (Get-Content testdata/componentes-locales.txt) --compile --out testdata/cobertura-l4-locales.csv
```

La medicion se vigila a si misma: el bridge cancela el recorrido cuando el heap de Studio pasa del 80 % (ver
INTERNALS 39), asi que una tanda larga no deja el IDE sin memoria.

Los que no compilan en estos tres grupos son 8, y todos necesitan una configuracion real: `tFileInputXML` (los
espacios de nombres del XML), `tIntervalMatch` (la conexion de referencia), `tReplaceList` (la tabla de
reemplazos), `tReservoirSampling` (la columna de muestreo) y los dos de XML (`tWriteXMLField` y
`tWriteXMLFieldIn`, que necesitan el arbol XML de entrada). Ninguno falla por falta de artefacto.

En total, **259 componentes medidos a L3/L4, de los que 216 compilan (83 %)**: las nueve familias mas usadas
(134, de los que 99 compilan) y los 125 componentes que no piden artefacto (44 + 19 + 62, de los que 117
compilan).

Los 35 que no compilan en la medicion de las nueve familias se agrupan en:

| Causa | Cuantos | Que significa |
|---|---|---|
| Son la mitad de un par (`tAggregateIn`, `tSortIn`, `tArrayIn`, `tSurviveIn`...) | 12 | Necesitan su pareja conectada: solas no generan codigo |
| Falta una configuracion real (tablas de transformacion, schema, contexto) | 17 | El plan pone los valores por defecto, pero hay que darle lo que el componente pide ("cannot be resolved", "Index 0 out of bounds") |
| Version de libreria o artefacto que no encaja | 6 | Weka (`tFileOutputARFF`, `tFileInputXML`), SAP (`tSAPBapiOut`), el modulo de `tMap`... |

Con el metodo viejo, ademas, fallaban componentes que ahora compilan:

| Muestra | Antes | Ahora |
|---|---|---|
| `tFileOutputDelimited` | No compilaba (`The constructor File() is undefined`) | Compila |
| `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` | No compilaban (el origen no traia el schema fijo del componente) | Compilan |
| `tFileOutputPositional` | No compilaba (`Syntax error on token '<'`: la tabla `FORMATS` sin filas) | Compila |
| `tFilterRow`, `tSortRow`, `tAggregateRow` | "El `.item` sale, no genera codigo" | Compilan |
| `JDBCInput` | `Missing output connection` | Compila |

Lo que queda como limite del entorno: `tFileInputARFF`, `tFileInputXML` y `tFileOutputARFF` estan escritos para
otra version de Weka; `tFileInputMSXML` genera codigo con una llave sin cerrar; los componentes de base de datos
necesitan una conexion real del repositorio.

El catalogo entero no se mide de una vez: los componentes sin artefacto en el `.m2` de Studio tardan ~50 s cada uno
(el build de Maven corre en modo *offline*: en vez de descargar, falla con "Cannot access central ... in offline
mode"). Por eso se mide por familias, y **las familias que necesitan artefactos que no estan en el `.m2` no se miden
todavia** (son las raras y las que no aportan).

### Que artefacto pide cada familia

El indice de definiciones (`src/modules/component-definitions/`) declara, por componente, los `IMPORT` que exige
(`REQUIRED="true"`), con su coordenada Maven. Con eso se puede filtrar la medicion: se mide primero lo que no
pide nada, y lo que pide algo se mide solo si el artefacto esta ya en el repositorio local de Studio
(`<instalacion>/configuration/.m2/repository`).

| Familia | Componentes | Piden artefacto |
|---|---|---|
| `Logs_Errors` | 11 | 0 |
| `Databases/DB Specifics/PostgreSQL` | 15 | 0 (el driver si esta en el `.m2`) |
| `Processing` | 13 | 2 |
| `Orchestration` | 18 | 1 |
| `Misc` | 10 | 2 |
| `File/Management` | 13 | 5 |
| `XML` | 13 | 8 |
| `Data_Quality` | 19 | 13 |
| `Business/SAP` | 18 | 15 |
| `Internet` | 15 | 11 |
| `ELT/Connections` | 20 | 11 |

Lo que **ya esta** en el `.m2` de esta instalacion (y por tanto compila sin descargar nada): `dom4j 2.1.3` (XML),
`json-path 2.9.0` (JSON), `talend_file_enhanced 1.3.1` (archivos), `talend-common-utils 1.0`,
`commons-compress 1.28.0`, `advancedPersistentLookupLib 1.6` y los drivers de PostgreSQL (`42.7.13` y `42.7.4`).

Lo que **no esta** y hay que instalar a mano:

| Artefacto | Quien lo pide | De donde sale |
|---|---|---|
| `talend-tmap-dataset 1.2.16` | `tMap` (y `tMapMulti`?) | **Talend Exchange**, no Maven Central |
| `sapjco3 6.0.0` | los 15 componentes de SAP | Repositorio de Talend (no accesible desde aqui) |
| `hadoop-client-* 3.3.4` | `Big Data/HDFS`, `File/Hadoop` | Maven Central (descargable) |
| `OneWireAPI 0.1` | `tAddCRCRow` | Maven Central |
| `geoip 1.0.0` | `tAddLocationFromIP` | Maven Central |

**Los dominios de Talend Exchange (`exchange.talend.com`, `components.talend.com`) no resuelven en DNS desde esta
maquina**: no hay forma de instalar ahi el jar del `tMap` automaticamente. `talend_studio_install_artifact` solo
descarga de Maven Central, y ahi el `talend-tmap-dataset` no existe. Para el `tMap` hay que instalar el componente
desde el propio Studio ("Additional components" / Talend Exchange) o copiar el jar a mano al `.m2` de Studio.

Esto es lo que hace lento el catalogo completo: no es la medicion, es la red.

Esto es L1/L2/L3/L4 (ver [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md)): que el componente exista,
acepte configuracion, se pueda conectar y compile. **No** dice que ejecute bien: eso es L5, y esta validado en
**14 escenarios** con la salida verificada.

## Ejecucion con la salida esperada (L5)

`bun run scripts/execution-check.ts` monta cada escenario de `tests/fixtures/talend/escenarios-l5.json`, lo ejecuta
y **compara la salida con la que se declaro antes de ejecutar** (lineas exactas, lineas que tienen que aparecer o
el fichero que escribe). El informe queda en `testdata/resultados-l5.csv`.

| Comando | Que hace |
|---|---|
| `bun run scripts/execution-check.ts` | Monta y ejecuta todos los escenarios |
| `bun run scripts/execution-check.ts agregar` | Solo los escenarios cuyo nombre contenga ese texto |
| `L5_KEEP_JOBS=1 bun run scripts/execution-check.ts` | Deja los jobs montados en Studio (por defecto se borran). En PowerShell: `$env:L5_KEEP_JOBS="1"; bun run scripts/execution-check.ts` |

En el JSON de escenarios, `@TESTDATA@` es la carpeta `testdata/` (los datos que usan: `l5_clientes.csv`,
`l5_clientes.json`, `l5_ventas.csv`). Los escenarios de base de datos necesitan el Postgres de
`testdata/docker-compose.yml` (puerto 5433):

```bash
docker compose -f testdata/docker-compose.yml up -d
```

| Escenario | Estado |
|---|---|
| `tFixedFlowInput` -> `tLogRow` | Correcto: `1\|Bogota`, `2\|Medellin` |
| `tFileInputDelimited` -> `tLogRow` | Correcto: las cuatro filas, con el separador y los decimales tal cual |
| `tFileInputDelimited` -> `tFileOutputDelimited` | Correcto: el fichero escrito tiene las cuatro filas |
| `tFileInputDelimited` -> `tUniqRow` -> `tSortRow` -> `tLogRow` | Correcto: quita el duplicado y ordena por monto descendente |
| `tFileInputDelimited` -> `tFilterRow` -> `tLogRow` | Correcto: deja solo las filas con monto mayor que 150 |
| dos `tFileInputDelimited` -> `tUnite` -> `tLogRow` | Correcto: salen las ocho filas (las dos fuentes) |
| `tFileInputDelimited` -> `tMap` -> `tLogRow` | Correcto: el `tMap` renombra la columna con `toUpperCase()` y filtra por monto (`2\|JOSE`, `3\|LUCIA`). El modelo del `tMap` (entradas, salidas con sus expresiones y filtros) lo monta el arnes con el `mapper` del bridge |
| `tFixedFlowInput` -> `tFileOutputJSON` | Correcto: el JSON escrito tiene las filas |
| `tFileInputDelimited` (fichero que no existe) -> `tLogRow` -> trigger de error -> `tFileOutputDelimited` | Correcto: el trigger se dispara y el manejador escribe su fichero (ver INTERNALS 40) |
| `tPrejob` -> `tRunJob` (hijo) -> `tPostjob` | Correcto: el padre llama al hijo y su salida sale en la del padre |
| `tPostgresqlConnection` -> `tPostgresqlInput` -> `tLogRow` | Correcto: lee las diez filas del Postgres de pruebas (ver INTERNALS 35) |
| contextos: crear un entorno y sus variables | Correcto: el job tiene los dos entornos con sus valores. El `tContextLoad` no saca filas (necesita su `nodeData` con la lista de variables a cargar), asi que el valor se comprueba en el modelo |
| `tFileInputDelimited` -> `tAggregateRow` -> `tLogRow` | **Correcto** (nuevo): agrupa por ciudad y suma el monto (`Bogota\|201.0\|2`, `Medellin\|200.25\|1`, `Cali\|300.0\|1`). La tabla de salida del agregado va la primera en su lista de metadata (ver INTERNALS 41) |
| `tPostgresqlConnection` -> `tPostgresqlOutput` (sin componente de commit) | **Correcto** (nuevo): escribe las dos filas y la consulta de comprobacion devuelve 2. La conexion va con `AUTO_COMMIT=true` y **no** hay ningun `tPostgresqlCommit` encolado (ver INTERNALS 45) |
| `tFileInputJSON` -> `tLogRow` | **Pendiente**: el pom del job no hereda las librerias que declara el componente (json-simple) y el codigo no compila (`org.json.simple.JSONValue cannot be resolved to a type`). El jar si esta en el `.m2` de Studio; lo que falta es que el build lo anada al pom. La escritura de JSON si funciona |
| `tFileList` -> `tLogRow` | **Pendiente**: el `tFileList` saca las filas pero vacias: la columna `CURRENT_FILE` nunca se rellena (los valores que deja el componente van al `globalMap`, no a la fila). El listado de la carpeta si se hace |
| `tFixedFlowInput` -> `tJavaRow` -> `tLogRow` | **Pendiente**: la salida del `tJavaRow` la define el parametro `SCHEMA`, que el bridge no deja con la forma que espera el generador (los `elementValue` de tipo `SCHEMA_COLUMN`/`TYPE`), asi que la fila de salida sale sin columnas (`nombre_mayus cannot be resolved`). Ademas, si el metadata lleva una columna entera, la salida la genera como `int` y el codigo hace `row.id != null`, que no compila |
| `tFixedFlowInput` -> `tNormalize` -> `tLogRow` | **Pendiente**: el codigo generado del `tNormalize` copia las columnas de la salida desde las de la entrada por el mismo nombre, sin usar la columna a normalizar, asi que la entrada y la salida no pueden tener nombres distintos (`apellido cannot be resolved or is not a field`) |

**Catorce escenarios en verde (los 14 pasan) y cuatro pendientes.** Los dos desbloqueados en esta tanda son el del
`tAggregateRow` (que ya se ejecuta con su formato real de tabla, INTERNALS 41) y el de escritura en Postgres (que
necesitaba el nombre de columna en la base de datos y el `AUTO_COMMIT` en la conexion, INTERNALS 43 y 45). El
escenario de escritura en Postgres se llamaba antes "...y confirmar" y usaba un `tDBCommit`: asi no funcionaba.

El `tMap` compila y se ejecuta **sin** el `talend-tmap-dataset` del Exchange: ese jar solo hace falta para el
editor visual del mapper, no para generar codigo ni para ejecutar.

Los pasos para ejecutar y leer la salida estan en INTERNALS 33: primero el Run de Studio (que genera y compila),
despues el relanzamiento que devuelve las lineas. El formato de las tablas de las transformaciones, en INTERNALS 32.

## Reglas para configurar un componente

Las reglas que hacen que un job compile y se ejecute. Salen de los casos que ya estan resueltos; el detalle de cada
una esta en [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md), secciones 41 a 45.

### El `tAggregateRow`: cuatro reglas

El `tAggregateRow` (y el `tAggregateSortedRow`) es un componente "virtual": en el IDE es un par (`tAggregateIn` +
`tAggregateOut`) y su codigo se genera con las plantillas de esos dos.

1. **La tabla de salida va la primera** de la lista de metadata del nodo. En el spec del arnes, el orden de
   `esquemas` es el orden de la lista: la primera entrada es la de salida.
2. **El origen se queda con una sola tabla**: la de salida del agregado. La tabla de entrada es la de la conexion,
   no hace falta declararla (y declararla crea una tabla suelta que no usa nadie).
3. **Las tablas del agregado (`GROUPBYS`, `OPERATIONS`) usan el nombre simple de la columna**, no `row1.columna`, y
   las funciones van en minusculas (`sum`, `count`, `max`...).
4. **El numero de columnas del origen tiene que ser el mismo que el de la salida del agregado**: el generador del
   `tFileInputDelimited` asigna los valores del fichero por posicion contra el esquema del destino.

Por el punto 4, el escenario del agregado lee `testdata/l5_ventas.csv` (`ciudad;monto;cliente`): el origen declara
las tres columnas y la salida del agregado declara tres.

### El orden de los esquemas: los origenes al final

Al conectar dos componentes, Talend sincroniza el origen con el destino: si el destino ya tiene esquema, **el
origen se queda con esas columnas** (y su tabla de rechazo tambien). Es el comportamiento del IDE (alli sale un
aviso), pero por API pasa en silencio.

Por eso el esquema del origen se pone **despues de conectar**. En el arnes el nodo se marca con
`"schemaDespuesDeConectar": true`, y los esquemas "despues" se aplican **con los nodos origen al final**: son los que
se han quedado descolocados.

Ademas, la tabla de rechazo (`REJECT`) del origen queda con las columnas del destino y el generador del lector
falla (`Index N out of bounds`). El bridge lo arregla solo: si la tabla de rechazo tiene columnas que no son del
propio nodo, la deja con las dos de error (`errorCode` y `errorMessage`).

### El nombre de la columna en la base de datos

Un `IMetadataColumn` tiene tres nombres: la etiqueta (`getLabel`), el id (`getId`) y el nombre de la columna en la
base de datos (`getColumnName`). **No hay `setColumnName`**: el nombre de la BD se pone con
`setOriginalDbColumnName`. Sin eso, el `tDBOutput` genera el `INSERT` con los nombres de columna a null:

```sql
INSERT INTO "l5_salida" (null,null,null,null) VALUES (('1'::int4),('Ana'),('Bogota'),('100.5'::double precision))
```

que el Postgres rechaza con `column "null" does not exist`. El bridge lo pone en los dos caminos que crean
columnas (`ComponentConfigurator` y `SchemaOperations`): si solo se pusiera en uno, el esquema se contagia por la
conexion y el bug vuelve.

### Los parametros de lista cerrada, sin comillas

El IDE escribe los valores de un parametro de tipo `CLOSED_LIST` **sin comillas** (`value="TRUNCATE"`) y los de
tipo `TEXT` o `DBTABLE` **con comillas** (`value="&quot;l5_salida&quot;"`). Con comillas, ninguna comparacion de la
plantilla encaja: el `TABLE_ACTION` de un `tDBOutput` valia `"TRUNCATE"` y la accion de tabla no se ejecutaba, sin
ningun error visible. Lo mismo con `COMPONENT_LIST`.

### Escribir en una base de datos

1. El `tDBOutput` (o `tPostgresqlOutput`) con `USE_EXISTING_CONNECTION=true` y la conexion compartida.
2. La conexion con `AUTO_COMMIT=true`. El `tDBOutput` no hace commit por su cuenta: escribe el lote al final (en la
   seccion "end" del componente) y, sin commit, al cerrar la conexion se pierde todo.
3. **No hay que encolar un `tPostgresqlCommit`**. Si se encola (conectado a la salida del output), se ejecuta
   **dentro del bucle de filas**: el output emite cada fila al downstream, el commit hace `commit()` y cierra la
   conexion, y el lote que se escribe al final falla con `This connection has been closed`.
4. `TABLE_ACTION` es un valor de la lista cerrada: `NONE`, `DROP_CREATE`, `CREATE`, `CREATE_IF_NOT_EXISTS`,
   `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE`. `DELETE` no existe.
5. Las columnas que se escriben van en la tabla `FIELD_OPTIONS` (cinco campos por columna: `SCHEMA_COLUMN`,
   `UPDATE_KEY`, `DELETE_KEY`, `UPDATABLE`, `INSERTABLE`). En el spec del arnes, `FIELD_OPTIONS` es un parametro de
   tipo TABLE: va en `tablas`, no en `parameters`.
6. `MAPPING` es el id del motor (`PostgreSQL`, `MySQL`...), no el nombre del componente.

### Como se comprueba cada cosa

| Que | Como |
|---|---|
| Montar y ejecutar un escenario L5 | `bun run scripts/execution-check.ts [filtro]` (el informe sale en `testdata/resultados-l5.csv`) |
| Levantar el Postgres de pruebas | `docker compose -f testdata/docker-compose.yml up -d` |
| Recargar el plugin Java (los arreglos del bridge) | `bun run scripts/start.ts --install-bridge` (no con una medicion en marcha) |
| Medir la cobertura de unos componentes | `bun run scripts/coverage.ts --components <lista> --compile --out <csv>` |
