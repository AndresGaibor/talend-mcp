# P06 · Cloud y mensajeria

Nivel 8 del catalogo (~60 componentes Standard). En la migracion, la nube aparece como destino de ficheros (S3, GCS),
como bus (Kafka, JMS, SQS) y como almacen analitico (BigQuery). Ninguno se puede probar contra el servicio real sin
cuentas de pago, asi que **toda la familia se prueba con emuladores** (A-emu) salvo Kafka y JMS, que tienen imagen real.

- Catalogo: [cloud](../catalogo-componentes/cloud.md), [messaging](../catalogo-componentes/messaging.md),
  [storage](../catalogo-componentes/storage.md), [big-data](../catalogo-componentes/big-data.md) (BigQuery, Dataproc),
  [databases](../catalogo-componentes/databases.md) (DynamoDB, CosmosDB), [internet](../catalogo-componentes/internet.md)
  (MOM, JMS, Dropbox, Box).
- Suites: `aws` (existe), y nuevas `gcp`, `azure`, `mensajeria` (se anaden a `SCENARIO_SUITES`, ver README seccion 7).
- Detalle de cada emulador y de sus limites: [EMULADORES.md](EMULADORES.md), secciones 3 y 5.

## 1. Mapa: componente -> emulador

| Componentes | Emulador | Peldano |
|---|---|---|
| `tS3*` (Connection, Put, Get, List, Copy, Delete, Close, Bucket Create/Delete/Exist/List) | **LocalStack** o MinIO (moto falla con `tS3Put` por `Expect: 100-continue`) | 1 |
| `tSQS*` (Connection, Input, Output, QueueCreate/Delete/List/Purge/Attributes, MessageDelete, ChangeVisibility) | LocalStack (moto devuelve decimales que rompen `QueueAttributes`) | 1 |
| `tDynamoDB*` (`tDynamoDBV1Input/Output`, y el resto) | `amazon/dynamodb-local` | 1 |
| `tAmazonEMR*`, `tAmazonRedshiftManage`, `tGoogleDataprocManage`, `tCloudStart/Stop` | Servidor HTTP falso de la API de gestion (crear/listar/redimensionar cluster) | 5 |
| `tGS*` (Connection, Put, Get, List, Copy, Delete, Close, Bucket*) | `fsouza/fake-gcs-server` | 1 |
| `tBigQuery*` (Input, Output, OutputBulk, BulkExec, SQLRow) | `ghcr.io/goccy/bigquery-emulator` | 1 |
| `tCosmosDB*` | Emulador de Cosmos DB (pesado) o servidor falso del API SQL | 1 / 5 |
| `tKafka*` (Connection, Input, Output, Commit, CreateTopic) | `apache/kafka` (KRaft) o `redpandadata/redpanda` | 1 |
| `tMapRStreams*` | Kafka (la API es compatible con Kafka) | 2 |
| `tJMS*`, `tMom*` (`tMomInput/Output/Connection/Commit/Rollback/MessageIdList`) | `apache/activemq-classic` | 1 |
| `tMicrosoftMQ*` | Servidor falso (MSMQ es solo Windows) o doble del cliente | 5 / 6 |
| `tJBossESB*` | Servidor falso del endpoint | 5 |
| `tDropbox*`, `tBox*` | Servidor HTTPS falso + proxy + truststore de prueba (el SDK fija la URL) | 5 |
| Snowflake, Databricks (DBFS), Synapse | Postgres/H2 con driver shim; DBFS contra un servidor HTTP falso | 4 / 5 |

## 2. Entorno

Anade a `testdata/docker-compose.yml`: `localstack`, `dynamodb-local`, `fake-gcs`, `bigquery-emulator`, `kafka`,
`activemq`, y, si hace falta, `minio`. **Un servicio o una familia cada vez** (memoria). `moto` se queda para lo que ya
pasa. Todos con `healthcheck` y un script de siembra (`testdata/<servicio>/init.*`).

En los componentes de AWS actuales hay una opcion de **endpoint propio** (`Use endpoint`/`ENDPOINT`); en los de Google y
Azure suele haber una variable de entorno (`STORAGE_EMULATOR_HOST`, `BIGQUERY_EMULATOR_HOST`, `PUBSUB_EMULATOR_HOST`)
o una URL de servicio. **Lee la definicion** (`talend_studio_component_parameters`): ahi esta el nombre exacto.

## 3. Orden de trabajo

1. **AWS completo** (ya hay 20 escenarios). Cerrar los dos pendientes cambiando a LocalStack: `tS3Put` (`Status 100`) y
   `tSQSQueueAttributes` (decimales). Luego `tDynamoDB*` restantes.
2. **Kafka** (`tKafkaCreateTopic` -> `tKafkaOutput` -> `tKafkaInput`, con `tKafkaCommit`) y **JMS/MOM** con ActiveMQ.
3. **GCS** y **BigQuery**.
4. **Dropbox / Box** (servidor falso con proxy).
5. **Cosmos, EMR, Dataproc, Cloud, MSMQ, JBoss ESB** (servidores falsos y dobles).

## 4. Patrones de escenario

**Almacen de objetos** (S3, GCS): `crear bucket -> subir -> listar -> bajar -> comparar -> copiar -> borrar objeto ->
borrar bucket`. El bucket lo crea y lo borra el propio escenario (SUBJOB_OK), para que sea independiente del orden.
Comprobar el contenido bajado con `tFileCompare`.

**Cola / bus** (SQS, Kafka, JMS): `crear cola o topic -> publicar N mensajes -> consumir N -> comparar -> purgar/borrar`.
Para el consumidor, fijar un tope (`tKafkaInput` con `MAX_MESSAGES`/timeout, `tSQSInput` con `MAX_NUMBER_OF_MESSAGES`):
un consumidor sin fin cuelga la corrida.

**Almacen analitico** (BigQuery, Cosmos, Dynamo): `crear tabla -> cargar filas -> leer con filtro -> comparar`.

**Gestion de cluster** (EMR, Dataproc, Cloud): contra el servidor falso, comprobar que el job envia la peticion correcta
(metodo, ruta, cuerpo) y que procesa la respuesta grabada. El servidor falso registra las peticiones; el test las
compara.

## 5. Trampas

| Trampa | Que hacer |
|---|---|
| `Status Code: 100` en `tS3Put` | LocalStack o MinIO en vez de moto |
| `NumberFormatException` en `tSQSQueueAttributes` | LocalStack |
| Credenciales | Usar `test`/`test` y la region del emulador; nunca credenciales reales |
| Region y estilo de URL de S3 (path-style) | Activar path-style cuando el endpoint es `localhost` |
| Consumidor sin fin | Siempre con tope de mensajes o de tiempo |
| Mensajes no ordenados (SQS estandar) | Comparar con `espera.contiene` |
| Topic ya existente | Que el escenario cree un topic con nombre unico y lo borre |
| El SDK ignora el proxy | Pasar las propiedades de la JVM del job (`tSetProxy`) y `-Djavax.net.ssl.trustStore` con `tSetKeystore` |

## 6. Aceptacion de P06

- Cada componente ejecutado (A con Kafka/ActiveMQ; A-emu con el resto) y su ficha dice el emulador y lo que no valida
  (cuotas, IAM, consistencia eventual, firma real de las peticiones).
- Los dos pendientes de AWS resueltos.
- Servicios en el compose con `healthcheck`; suites nuevas declaradas y documentadas.
- Fichas en `docs/fichas-componentes/cloud.md`, `messaging.md`, `storage.md`.
