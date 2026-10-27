# Emuladores y sustitutos: como ejecutar lo que no se puede levantar

Regla del plan ([README, seccion 2](README.md)): **todo componente se ejecuta**. Este documento dice como. Para cada
componente que depende de un servicio, el agente recorre la escalera de arriba abajo y se queda con el primer
peldano que consigue ejecutar el componente de verdad (el codigo generado real, no un simulacro del componente).

> Principio: lo que se sustituye es **el servicio**, nunca **el componente**. El job que se prueba es el mismo que se
> usaria en produccion; solo cambia a donde apunta (`HOST`, `PORT`, URL, driver).

## 1. La escalera

| Peldano | Cuando | Ejemplo | Coste |
|---|---|---|---|
| 1. Contenedor real | Hay imagen oficial o de comunidad | Postgres, MySQL, Oracle, MSSql, DB2, Mongo, Kafka, LDAP, SFTP | Memoria; un servicio cada vez |
| 2. Compatible por protocolo | Otro producto habla el mismo protocolo | Greenplum / Redshift / Aurora-Postgres / Vertica-lite contra Postgres; MariaDB / Aurora-MySQL contra MySQL | Bajo |
| 3. Motor embebido en modo compatibilidad | Basta con el dialecto SQL basico | **H2** en modo `Oracle`, `MSSQLServer`, `DB2`, `MySQL`, `PostgreSQL`, `Derby`, `HSQLDB` | Muy bajo (un jar) |
| 4. Driver "shim" | El fabricante no da imagen ni emulador, pero el componente solo necesita un driver JDBC | Teradata, Netezza, Sybase, Informix, Ingres, AS400, MaxDB, SAP HANA, VectorWise, Exasol | Medio (se escribe una vez) |
| 5. Servidor falso | API HTTP/SOAP/TCP/SMTP/LDAP propia | Salesforce, ServiceNow, CRM, Dropbox, Box, REST, SOAP, WebService, RSS, Syslog | Medio |
| 6. Doble de la libreria cliente | El componente usa un SDK nativo del fabricante | SAP JCo, bibliotecas propietarias | Alto |
| 7. Excepcion (X) | Nada de lo anterior sirvio | Se documenta en `EXCEPCIONES.md` y decide la persona | - |

Cada escenario L5 declara que usa (`servicio` en la ficha) y la ficha dice **que no demuestra** el sustituto. Ejemplo
de nota honesta: *"Ejecutado contra H2 en modo Oracle. No valida `sqlldr`, tipos `NUMBER(38)` grandes ni la sintaxis
`MERGE` de Oracle 19c."*

## 2. Motores SQL

### 2.1 Contenedores reales (peldano 1)

Se anaden a `testdata/docker-compose.yml`, con `healthcheck` y un `init.sql`. Levantar **uno cada vez** (la maquina
tiene 13 GB y Studio ocupa 4).

```yaml
oracle:
  image: gvenzl/oracle-free:23-slim
  environment: { ORACLE_PASSWORD: lab, APP_USER: talend, APP_USER_PASSWORD: talend }
  ports: ["1522:1521"]
mssql:
  image: mcr.microsoft.com/mssql/server:2022-latest
  environment: { ACCEPT_EULA: "Y", MSSQL_SA_PASSWORD: "Talend_lab_1" }
  ports: ["1434:1433"]
db2:
  image: icr.io/db2_community/db2
  privileged: true
  environment: { LICENSE: accept, DB2INST1_PASSWORD: lab, DBNAME: talend }
  ports: ["50001:50000"]
```

Otros con imagen de comunidad: Vertica (`vertica/vertica-ce`), Exasol (`exasol/docker-db`, privilegiado), Informix
(`icr.io/informix/informix-developer-database`), Firebird (`jacobalberty/firebird`), MariaDB (`mariadb`), CockroachDB.

### 2.2 H2 como emulador de dialectos (peldano 3)

H2 corre embebido o como servidor TCP y soporta modos de compatibilidad: `Oracle`, `MSSQLServer`, `DB2`, `MySQL`,
`PostgreSQL`, `Derby`, `HSQLDB`. Sirve para ejercitar el codigo generado de los componentes de un motor **sin
contenedor**.

```bash
# servidor H2 en memoria, un modo por base
java -cp h2.jar org.h2.tools.Server -tcp -tcpPort 9092 -ifNotExists
# URL: jdbc:h2:tcp://localhost:9092/mem:oracle;MODE=Oracle;DATABASE_TO_LOWER=FALSE
```

Limites a escribir siempre en la ficha: H2 no implementa PL/SQL ni T-SQL completo, ni los catalogos del sistema de cada
motor (`ALL_TABLES`, `sys.tables`, `SYSCAT.TABLES`). Los componentes que **consultan esos catalogos** (para saber si una
tabla existe en `CREATE_IF_NOT_EXISTS`, o `TableList`/`ColumnList`) pueden fallar: en ese caso se crea la **vista
equivalente** en H2 (`CREATE VIEW ALL_TABLES AS SELECT ...`) en el `init.sql`, o se baja al peldano 1.

### 2.3 Driver shim (peldano 4)

Cuando el componente solo necesita un driver y nada mas (casi todos los de BD), el shim hace que **el codigo real**
corra sin el producto.

**Como funciona.** Un `java.sql.Driver` con el **mismo nombre de clase** que el del fabricante, que:

- `acceptsURL(url)` devuelve `true` para el prefijo del fabricante (`jdbc:teradata:`, `jdbc:netezza:`,
  `jdbc:sybase:Tds:`, `jdbc:informix-sqli:`, `jdbc:as400:`, `jdbc:sap:`...);
- `connect(url, props)` abre una conexion al **destino real de prueba** (Postgres o H2) y la devuelve;
- opcionalmente reescribe SQL con un diccionario pequeno (`TOP n` -> `LIMIT n`, `SEL` -> `SELECT`, `NVL` ->
  `COALESCE`...) cuando el componente lo necesita.

**Receta** (la hace el agente una vez; luego sirve para todos los motores):

1. Lee la clase y la URL de cada componente: `talend_components_definition` (`imports` da la coordenada Maven del jar)
   y el parametro `DRIVER_CLASS`/`URL` del `.item` que guarda Studio al montarlo.
2. Crea `testdata/driver-shim/` con `DriverShim.java` (la logica) y un `shims.json`
   (`[{ "class": "com.teradata.jdbc.TeraDriver", "prefix": "jdbc:teradata:", "target": "jdbc:postgresql://localhost:5433/talend_test", "user": "talend" }]`).
3. Un script `scripts/build-driver-shim.ts` que, por cada entrada, genera una subclase vacia con ese nombre y compila con
   el `javac` del JDK de Studio (`C:\Talend\8.0.1\zulu21...\bin\javac.exe`). Salida: `shim-<motor>.jar`.
4. Instalar el jar **con las mismas coordenadas Maven que pide el componente** para que Studio lo acepte como el
   modulo oficial: `talend_studio_install_artifact { groupId, artifactId, version, file: "<ruta del jar>" }`
   (el parametro `file` existe para jar locales).
5. Escenario normal: el componente apunta a `jdbc:teradata://localhost/...`; el shim reenvia a Postgres.

**Lo que NO demuestra** (escribirlo siempre): el dialecto real del fabricante, sus tipos propios, sus cargadores masivos
(`FastLoad`, `NzLoad`, `bcp`...) y su rendimiento. Los **cargadores masivos** son programas externos: se sustituyen por un
**script falso** del mismo nombre en el `PATH` (peldano 5) que valida los argumentos y carga el fichero en el destino.

## 3. Mensajeria, cloud y almacenes

| Familia | Sustituto | Notas |
|---|---|---|
| S3, SQS, Kinesis, DynamoDB | `moto` (ya en compose) o `localstack/localstack`; `amazon/dynamodb-local` | `moto` no soporta `Expect: 100-continue`: para `tS3Put` usar LocalStack o MinIO (`minio/minio`) |
| Google Cloud Storage | `fsouza/fake-gcs-server` | Endpoint por parametro |
| BigQuery | `ghcr.io/goccy/bigquery-emulator` | |
| Pub/Sub | emulador de `gcloud` (`gcloud beta emulators pubsub start`) | Variable `PUBSUB_EMULATOR_HOST` |
| Azure Blob / Storage | `mcr.microsoft.com/azure-storage/azurite` | |
| Cosmos DB | `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator` | Pesado; bajar a servidor falso si no cabe |
| Kafka | `apache/kafka` (KRaft) o `redpandadata/redpanda` | `tKafkaConnection/Input/Output/Commit` |
| JMS / MOM | `apache/activemq-classic` (JMS), `rabbitmq` si el componente habla AMQP | |
| MicrosoftMQ (MSMQ) | Servidor falso de la API o doble de cliente | Solo existe en Windows |
| Dropbox, Box, SaaS | Servidor HTTP falso + ver "SDK con URL fija" abajo | |
| Snowflake, Databricks, Synapse | Postgres/H2 con shim (peldano 4) | Solo valida el codigo generado, no el servicio |

**SDK con URL fija.** Algunos SDK (Dropbox, Box, Salesforce con login fijo) no permiten cambiar el host. Se resuelve
sin tocar el componente: un servidor HTTPS falso en local, un certificado de prueba y la JVM del job apuntando a el con
`tSetProxy` (o `-Dhttps.proxyHost`) y a un `truststore` de prueba (`tSetKeystore` / `-Djavax.net.ssl.trustStore`).
El servidor responde con las respuestas grabadas de la API. Esto mantiene el SDK real en juego.

## 4. NoSQL, Big Data y busqueda

| Servicio | Imagen / sustituto |
|---|---|
| MongoDB | `mongo:7` (ya en compose, puerto 27018) |
| Cassandra | `cassandra:4` |
| HBase | `harisekhon/hbase` |
| Elasticsearch | `elasticsearch:8` (un nodo, `discovery.type=single-node`, seguridad desactivada) |
| Neo4j | `neo4j` |
| Couchbase | `couchbase` |
| Redis | `redis` |
| Hive / Impala emulado / HDFS | Ya en compose (10000, 21051, 9000/9870) |
| Spark | Modo local (`local[*]`) dentro del propio job; en Windows hace falta `winutils.exe` y `HADOOP_HOME` |
| MapReduce | `mapreduce.framework.name=local` |
| Sqoop / HCatalog | Contra Hive/Postgres locales; si piden un cluster, servidor falso de `sqoop` en el `PATH` |
| Kudu, Delta Lake, Iceberg | Iceberg y Delta funcionan en local sobre ficheros (catalogo Hadoop local) |

## 5. Protocolos y servicios de aplicacion

| Servicio | Sustituto |
|---|---|
| SMTP (`tSendMail`) | MailHog (`mailhog/mailhog`: SMTP 1025, API 8025) |
| POP3/IMAP (`tPOP`) | GreenMail (`greenmail/standalone`) |
| FTP | `stilliard/pure-ftpd` (ya en compose, 2121) |
| SFTP / SCP / SSH | `atmoz/sftp` (SFTP) y `linuxserver/openssh-server` (SSH/SCP) |
| LDAP | `osixia/openldap` (o `bitnami/openldap`) con un LDIF de prueba |
| HTTP / REST / SOAP / WebService / RSS / XML-RPC | Servidor falso con `Bun.serve` (ver `scripts/l5/http-sink.ts`); para SOAP, WSDL y respuestas grabadas en `testdata/` |
| Syslog | Un `Bun` UDP que escribe lo que recibe |
| Sockets (`tSocketInput/Output`, `tWaitForSocket`, `tServerAlive`) | `Bun` TCP |
| Salesforce, ServiceNow, CRM | Servidor falso con login y consulta (endpoints configurables en el componente) |
| SAP (RFC/IDoc/BAPI) | Peldano 6: doble de `sapjco3.jar` con las clases que usa el codigo generado; leer el `.java` del job para saber cuales |
| GPG (`tGPGDecrypt`) | Instalar `gpg` (Gpg4win / `apt`) y generar una clave en `testdata/` |
| Pipes con nombre | En Windows `\\.\pipe\...` con un proceso auxiliar; en Linux `mkfifo` |
| Interfaz (`tMsgBox`) | Ejecutar en sesion con escritorio y cerrar el dialogo desde un hilo del propio job con `java.awt.Robot`; sin escritorio, `-Djava.awt.headless=true` produce un error que **es** el comportamiento esperado: documentarlo |
| ESB (`tESB*`) | Runtime de Talend (Karaf) incluido en Studio ("Services"); el consumidor contra un SOAP falso |
| Talend Cloud (`tCloudStart/Stop`) | Servidor HTTP falso de la API de TMC |

## 6. El arnes: declarar el servicio que necesita un escenario

Hoy los escenarios de BD asumen el Postgres (5433). Para que un agente pueda lanzar cualquier cosa, **anade al contrato**
del escenario (`scripts/l5/scenario-types.ts`) un campo opcional:

```json
"requiere": ["oracle"]
```

y en `execution-check`:

1. Si el escenario declara `requiere`, comprobar que ese servicio responde en su puerto; si no, levantarlo con
   `docker compose -f testdata/docker-compose.yml up -d <servicio>` y esperar su `healthcheck`.
2. Si no se puede, el escenario sale como **pendiente con motivo** (nunca como correcto) y entra en `EXCEPCIONES.md`.
3. Generalizar `espera.consulta` a `{ motor, sql, valor }` (hoy es solo Postgres) o, mejor, comprobar los datos
   leyendolos de vuelta en el mismo job (ver [P03](P03-bases-de-datos-relacionales.md), seccion 3).

Con tests (`tests/l5/`) y documentado en `docs/plan-de-pruebas/03-ejecucion-l5.md`.

## 7. Fichero de excepciones

`docs/plan-componentes/EXCEPCIONES.md` (lo crea el agente la primera vez que lo necesita):

| Componente | Servicio | Peldanos intentados | Por que falla | Que haria falta | Estado |
|---|---|---|---|---|---|
| `tXxx` | ... | 1, 2, 3 | ... | un SAP real / un jar del fabricante | pendiente de decision |

El agente nunca da una excepcion por cerrada: solo la persona responsable la acepta, la resuelve aportando el servicio o
pide otro sustituto. El informe final (README, seccion 10) cuenta cuantas hay.
