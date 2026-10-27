# P10 · Paletas Spark, Spark Streaming, Structured Streaming y MapReduce

Nivel 13 del catalogo: **398 definiciones** que comparten nombre con los componentes Standard (`tMap`, `tFileInputDelimited`,
`tLogRow`...) pero pertenecen a otros tipos de job. Un componente de Spark **no es** el mismo que su homonimo
Standard: otro generador de codigo, otras librerias, otro modelo de ejecucion.

| Paleta | Definiciones | Tipo de job en Studio |
|---|---|---|
| `SPARK` | 152 | Big Data Batch (framework Spark) |
| `SPARKSTREAMING` | 160 | Big Data Streaming (DStreams) |
| `STRUCTUREDSTREAMING` | 51 | Big Data Streaming (Structured Streaming) |
| `OTHER` / MapReduce | 1 y los de [mapreduce](../catalogo-componentes/mapreduce.md) | MapReduce |

- Catalogo: todos los ficheros de `docs/catalogo-componentes/` tienen filas con `Paleta` distinta de `DI`; busca
  `| SPARK |`, `| SPARKSTREAMING |`, `| STRUCTUREDSTREAMING |`.
- Suite nueva: `spark` (anadir a `SCENARIO_SUITES`, y `streaming` para los de flujo continuo).
- **Esta fase va la ultima** (README seccion 4): el valor para la migracion es menor y el coste de entorno, mayor.

## 1. Lo que cambia respecto a un job Standard

1. **Crear el job con el tipo correcto.** `talend_job_create_in_studio` admite `jobType` (`Big_Data_Batch`,
   `Big_Data_Stream`) y `framework` (`Spark`, `Storm`, `MapReduce`). Sin eso se montan componentes de la paleta Standard.
2. **Listar los componentes de esa paleta**: `talend_studio_list_components` con `paletteType` (`SPARK`...), no `DI` (tras el cambio de codigo de abajo).
3. **Los conectores son distintos**: los de Spark son `FLOW` y poco mas; no hay `SUBJOB_OK` entre subjobs.
4. **La ejecucion es Spark**: `local[*]` dentro de la JVM del job, sin cluster, o un cluster en contenedor.
5. **Las librerias son enormes** (Spark, Hadoop, Scala): la primera compilacion descarga cientos de MB. Hazla una vez
   y con paciencia (`installMissing`).

### Cambios de codigo previos (hay que hacerlos antes de probar nada)

El soporte de paletas **existe en el bridge Java pero no llega a las tools de TypeScript**. Estado verificado en el
codigo:

| Pieza | Estado |
|---|---|
| Crear job con tipo y framework | **Existe**: `talend_job_create_in_studio` acepta `jobType` y `framework` |
| `ComponentCatalog.list` (Java) | **Existe** el parametro `paletteType` (`DI` por defecto; `*` para todas) |
| `BridgeNodeClient.listComponents` y `talend_studio_list_components` | **Falta**: solo pasan `filter` y `limit`. Hay que anadir `paletteType` |
| `findCatalogComponent(name, paletteType)` (Java) | **Existe**, pero `talend_job_add_node` busca en la paleta `DI` por defecto. Hay que usar la paleta del job abierto o un parametro `paletteType` |
| `Escenario` del arnes L5 | **Falta**: no hay `tipoJob`/`framework`. Anadirlos y pasarlos a `createJob` |
| Generador de jobs por fichero (`job-xml.ts`) | **Falta**: el `jobType` sale siempre `Standard`. Parametrizar `JobSpec.jobType` y `framework` |

Cada cambio lleva su test. Sin ellos no se puede montar ni un componente de Spark desde el arnes. Quedan reflejados en
la lista de cambios de la seccion 8.

## 2. Entorno

| Necesidad | Solucion |
|---|---|
| Ejecutar Spark Batch sin cluster | Modo local (`Spark Mode = Local`, `local[*]`) en las propiedades del job; es el unico que cabe en 13 GB |
| Spark en Windows | `HADOOP_HOME` con `winutils.exe` y `hadoop.dll` de la version de Hadoop que use el job |
| Streaming | Kafka local (`apache/kafka`) como fuente, o un socket/directorio vigilado con `Bun`; el job corre un tiempo acotado |
| MapReduce | `mapreduce.framework.name=local` (ejecutor local de Hadoop) |
| HDFS / Hive | Los contenedores existentes de `testdata/docker-compose.yml` |
| Memoria | El job Spark local usa 1-2 GB; cerrar los demas contenedores pesados |

Documenta en `docs/studio-internals/` cada trampa nueva (por ejemplo, la variable `HADOOP_HOME` de la JVM del job).

## 3. Orden de trabajo

1. **Medir la compilacion de las 398 definiciones** con el mismo metodo offline (README seccion 5.2), creando los jobs
   con `jobType: Big_Data_Batch` / `Big_Data_Stream`. Es rapido y dice cuales fallan de verdad.
2. **Spark Batch, nucleo**: `tFileInputDelimited`, `tFileOutputDelimited`, `tMap`, `tFilterRow`, `tAggregateRow`, `tJoin`,
   `tSortRow`, `tUniqRow`, `tUnite`, `tReplicate`, `tNormalize`, `tLogRow`, `tFixedFlowInput`, `tRowGenerator`, `tJava*`.
   Mismos datos y mismas salidas que sus homonimos Standard: **el resultado debe ser identico**, y esa comparacion es la
   prueba.
3. **Spark Batch, entrada/salida**: `tHDFS*`, `tHiveInput/Output`, `tJDBC*` contra Postgres, `tMongoDB*`, `tCassandra*`,
   `tHBase*`, `tFileInput/Output` de Parquet, ORC, Avro, JSON.
4. **Spark Batch, Machine Learning** ([machine-learning](../catalogo-componentes/machine-learning.md),
   [ml](../catalogo-componentes/ml.md)): clasificacion, regresion, clustering y recomendacion de `MLlib`. Datos
   sinteticos pequenos con la respuesta conocida (por ejemplo, un conjunto separable).
5. **Spark Batch, calidad** (`tMatchModel`, `tMatchPairing`, `tMatchPredict`, `tStandardize`...): mismos datos que P09.
6. **Streaming**: `tKafkaInput`/`tKafkaOutput`, `tFileInputDelimited` vigilando un directorio, `tWindow`, `tSocket*`. Cada
   escenario acota el tiempo y comprueba lo recibido.
7. **MapReduce**: los pocos componentes de [mapreduce](../catalogo-componentes/mapreduce.md), con el ejecutor local.
8. **Componentes de configuracion** (`t*Configuration`, `tHDFSConfiguration`, `tS3Configuration`...): se prueban
   dentro de un job que los usa; su resultado es que el job se conecta.

## 4. Patron de escenario

Un job de Spark se ejecuta como cualquier otro job desde el arnes, pero:

- El `job` se crea con `jobType`/`framework` (campos de creacion; si el arnes no los pasa aun, **anadelos a
  `Escenario`** con test y documentalos).
- La salida de un `tLogRow` en Spark local aparece en stdout igual que en Standard; en cluster iria al log de Spark.
- Para streaming, el escenario declara `timeoutMs` y `espera.contiene` (el orden de microlotes no esta garantizado).

## 5. Equivalencia con la paleta Standard

Para cada componente con homonimo Standard ya en A:

1. Reutiliza los **mismos datos** y la **misma salida esperada**.
2. Anota en la ficha del componente Standard una seccion "En Spark" con las diferencias (parametros que faltan o
   sobran, comportamiento distinto con nulos, orden de salida no determinista, tipos).
3. Si el resultado difiere, es un hallazgo: documentalo en `04-reglas-de-componentes.md`.

## 6. Trampas

| Trampa | Que hacer |
|---|---|
| Descarga eterna de librerias | Hacerla una vez, con `installMissing`, y no repetir en cada escenario |
| `winutils` ausente | `java.io.IOException: Could not locate executable ... winutils.exe`: instalar y fijar `HADOOP_HOME` |
| Salida en desorden | Spark no garantiza orden: `espera.contiene` o ordenar en el propio job (`tSortRow`) |
| Memoria | `spark.driver.memory` bajo en el job; un solo job a la vez |
| Streaming que no termina | Siempre con tiempo maximo; el escenario lo para y lee lo acumulado |
| Versiones de Scala y Spark | Las fija la distribucion elegida en el job; no mezclar |
| Modelos de ML no deterministas | Fijar la semilla; comprobar una metrica con tolerancia, no un valor exacto |

## 7. Aceptacion de P10

- Las 398 definiciones compilan en un job del tipo que les corresponde (L4) **y** se ejecutan en modo local o con el
  servicio de apoyo (L5), con la salida comprobada.
- Cada componente con homonimo Standard tiene su comparacion de equivalencia.
- Los de ML y calidad con datos de respuesta conocida y tolerancia explicita.
- Fichas en `docs/fichas-componentes/spark.md`, `streaming.md`, `mapreduce.md`, `ml.md`.
- Suites `spark` y `streaming` declaradas y documentadas.

## 8. Cambios de codigo que este plan necesita

Lista consolidada (cada uno con test y documentado):

1. `paletteType` en `bridge.listComponents` y en la tool `talend_studio_list_components`.
2. `talend_job_add_node` resuelve el componente en la paleta del job abierto (o acepta `paletteType`).
3. `jobType` y `framework` en `Escenario` y en `montarJob` (`scripts/l5/job-mounter.ts`).
4. `JobSpec.jobType` y `framework` en `src/talend/job-generator/` (y en `talend_jobs_create_batch`).
5. Suites `spark` y `streaming` en `SCENARIO_SUITES`.
6. Campo `requiere` del escenario (EMULADORES.md seccion 6).
