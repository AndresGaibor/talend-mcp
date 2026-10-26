# Cobertura del catalogo

[Volver al indice](../PLAN-DE-PRUEBAS.md)

## Cobertura del catalogo

`bun run scripts/coverage.ts` crea, configura, **monta**, compila y borra cada componente **Standard (DI)** del catalogo
(897 componentes unicos; las 397 variantes de Spark y Streaming solo valen en jobs de ese tipo, ver INTERNALS 29) en
un job de pruebas (`MCP_Coverage`) y escribe `testdata/cobertura.csv`. Tarda ~5 min: arranca en el bridge y
consulta el progreso (una peticion HTTP unica la cortaria el cliente a los 5 min). Opciones: `--filter`, `--family`,
`--components`, `--max`, `--compile` (nivel L4), `--cancel`. Tras cada fallo el job de pruebas se reinicia, para
que un componente roto no contamine a los siguientes. `bun run scripts/coverage-summary.ts` agrupa los fallos.

El mapa por familia, los fallos que no son del componente y el orden de las proximas tandas estan
en [COBERTURA-POR-FAMILIA.md](../COBERTURA-POR-FAMILIA.md).

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

**Reevaluacion prioritaria L4** (`testdata/cobertura-l4-banca-prioritarios.csv`): 114 componentes de
`File`, `Processing`, `Data_Quality`, `Data_Privacy`, `Technical`, `Orchestration`, `Custom_Code`,
`Misc` y `Logs_Errors`, excluyendo dependencias Maven requeridas. Compilaron 85; 27 dieron error de
compilacion y 2 no llegaron a compilar porque Studio rechazo la conexion generica del arnes. Esta
tanda se solapa con informes anteriores y por eso no se suma al total unico del catalogo. L4 solo
confirma generacion y compilacion, no ejecucion correcta.

**Continuacion L4 sin repetir componentes con resultado previo:** se midieron 81 componentes de
MongoDB, Cassandra, Kafka, HBase, FTP, JMS, HDFS, MapR/Sqoop y utilidades locales. **54 compilaron,
25 fallaron al compilar y 2 no alcanzaron esa fase** (un timeout de Studio y `tSystem`, rechazado por
la conexion generica del arnes). Los informes son `testdata/cobertura-l4-nosql-messaging-tanda1.csv`,
`testdata/cobertura-l4-nosql-messaging-tanda2.csv`, `testdata/cobertura-l4-local-utils-tanda1.csv`,
`testdata/cobertura-l4-hdfs-prueba.csv`, `testdata/cobertura-l4-hdfs-tanda1.csv`,
`testdata/cobertura-l4-mapr-sqoop-tanda1.csv`, `testdata/cobertura-l4-ftp-tanda1.csv` y
`testdata/cobertura-l4-config-connectors-tanda1.csv`. El consolidado unico queda en **470 compilados,
101 con fallo y 342 sin resultado L4** de 913. `tAzureSynapseInput` solo se compilo; no se configuro
ni ejecuto contra Azure. L4 no valida ejecucion funcional.

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
compilan). Aparte van las **25 familias de `Databases/DB Specifics` (179 componentes, 177 compilan)**, medidas en
tandas posteriores (ver mas abajo), y los 42 del primer intento fallido que se repitieron.

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
mode"). Por eso se mide por familias. Que un componente pida un artefacto **no** impide medirlo a L4: el driver
solo hace falta para ejecutar (ver "Las familias de BD que piden driver compilan sin el driver", mas abajo).

### Primera tanda: las 17 familias de "DB Specifics" (76 de 77)

Medicion de las 17 familias de `Databases/DB Specifics` completas (AS400, Access, Aurora, Redshift, Oracle en
Amazon, Synapse, Cosmos DB, EXASolution, FireBird, HSQLDb, Hive, JDBC, JavaDb, MaxDB, SAP Hana, SQLite y
VectorWise), con `--compile --sin-artefacto`:

| Resultado | Cuantos |
|---|---|
| Componentes probados | 77 |
| Se crean | 75 (los 2 que faltan fueron timeouts de la interfaz, y despues compilaron) |
| Se configuran | 38 (el resto son `Close`, `Commit` y `Rollback`, que no tienen nada que configurar) |
| **Compilan (L4)** | **76** |
| No compilan | 1 |

El unico que no compila es `tCosmosDBClose`, que necesita el driver de MongoDB (`com.mongodb cannot be
resolved`): no esta ni en los plugins de Studio ni en su `.m2`, asi que va con la fase B (igual que SAP y
Hadoop). Los otros 76 quedan medidos.

**El primer intento de esta misma tanda salio mal y conviene saber por que.** Se midieron los 77 de una vez y a
mitad de la corrida se rompio el agregador Maven de Studio (`Child module ... does not exist`, INTERNALS 51):
42 de los 45 fallos eran ese error del build, no del componente, y el informe (`testdata/cobertura-l4-bd2.csv`)
no valia como medicion. La causa de fondo era el heap: con el JVM al 80 % el build empieza a fallar. Se arreglo
anadiendo a `scripts/coverage.ts` una **recoleccion forzada** (`/automation/memory` con `{"gc": true}`) cada vez
que la memoria pasa del 60 %, y repitiendo en tres tandas (21 + 21 + 2 componentes): las tres terminaron en
verde con el heap al 57 %.

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

### Las familias de BD que piden driver compilan sin el driver

Las ocho familias de `DB Specifics` que faltaban declaran en sus componentes un `IMPORT` obligatorio con el driver
JDBC, y **ninguno de esos drivers esta en el `.m2`** de esta instalacion:

| Familia | Artefacto obligatorio | En Maven Central |
|---|---|---|
| DB2 | `org.talend.libraries:db2jcc4:6.0.0` (y las dos licencias) | No (repo de Talend) |
| Greenplum | `com.infobright.io:namedpipe:1.0` | No |
| Informix | `com.ibm.informix:ifxjdbc:3.5` (y cinco mas) | No |
| Ingres | `com.ingres.jdbc:iijdbc:10.2-4.1.10` | No |
| Netezza | `org.talend.libraries:nzjdbc:6.0.0` | No |
| Sybase | (ninguno obligatorio) | — |
| Teradata | `com.teradata.jdbc:terajdbc4:17.10.00.27` | No esa version (solo 17.20) |
| Vertica | `com.vertica.jdbc:vertica-jdbc:12.0.4-0` | **Si** (se puede instalar) |

**Y aun asi compilan.** El codigo que genera Talend **no referencia las clases del driver**: lo carga por nombre al
ejecutar (`DriverManager`), asi que L4 (que el job compile) no necesita el jar. El jar hace falta para **ejecutar**
el job contra la base, y eso no se puede probar aqui sin servidor.

Medidas las ocho, en tres tandas:

| Tanda | Familias | Probados | Compilan |
|---|---|---|---|
| 1 | DB2, Greenplum | 24 | 24 |
| 2 | Informix, Ingres, Netezza | 34 | 33 |
| 3 | Sybase, Teradata, Vertica | 44 | 44 |
| **Total** | **8 familias** | **102** | **101** |

El unico que no compila es `tIngresBulkExec`, y no es configuracion: el codigo generado referencia una variable que
Talend no declara (`executableFilePath_tDBBulkExec_4 cannot be resolved`). Es un fallo de generacion del componente,
no del arnes.

Consecuencia practica: L4 de las familias de base de datos se puede medir sin instalar nada. Lo que no se puede es
dar L5 de esas familias sin driver y sin servidor. Sumando las 25 familias de `DB Specifics` medidas (17 + estas 8):
**179 componentes, 177 compilan (99 %)**. Las cuatro que faltaban (PostgreSQL, MySQL, MS SQL Server y Oracle) ya
estaban entre las nueve familias mas usadas.

Esto es lo que hace lento el catalogo completo: no es la medicion, es la red.

Esto es L1/L2/L3/L4 (ver [ROADMAP-DOMINIO-TALEND.md](../ROADMAP-DOMINIO-TALEND.md)): que el componente exista,
acepte configuracion, se pueda conectar y compile. **No** dice que ejecute bien: eso es L5, y esta validado en
**28 escenarios** con la salida verificada.
