# P03 · Bases de datos relacionales

Nivel 5 del catalogo (287 componentes Standard; la cifra exacta la da el catalogo). Es el bloque mas grande y el que mas riesgo tiene en una migracion
bancaria: es donde estan los datos. Se trabaja **por motor**, con el mismo patron de 12 escenarios, y en este orden.

- Catalogo: [databases](../catalogo-componentes/databases.md) (los `Databases/DB Specifics/*`), mas
  [elt](../catalogo-componentes/elt.md) para los `*SCDELT` (ver [P04](P04-elt-y-sql.md)).
- Suite L5: `bases de datos` (suite `bd`). Servicios: `testdata/docker-compose.yml` (se amplia).
- Hechos hoy: Postgresql y Mysql (parcial), JDBC (parcial; las librerias de los componentes JDBC nuevos no estan en
  repositorios publicos). Suite `bd`: 13 de 13 sin avisos.

## 1. Orden de motores

| Orden | Motor | Por que | Servicio local | Nivel esperado |
|---|---|---|---|---|
| 1 | **Postgresql** | Referencia; ya medio hecho | Contenedor existente (5433) | A |
| 2 | **Mysql** | Ya medio hecho | Contenedor existente (3307) | A |
| 3 | **Oracle** | El motor mas habitual en banca | `gvenzl/oracle-free:23-slim` | A |
| 4 | **MSSql** | Muy habitual | `mcr.microsoft.com/mssql/server:2022-latest` | A |
| 5 | **DB2** | Banca / mainframe | `icr.io/db2_community/db2` | A |
| 6 | **JDBC** (generico) | Cualquier motor sin componente propio | Cualquiera de los anteriores; los jar JDBC nuevos se instalan con `file` | A |
| 7 | Redshift, Greenplum, AmazonAurora, AmazonMysql, AmazonOracle, AzureSynapse | Compatibles por protocolo con los anteriores | Se prueban contra Postgres / MySQL / Oracle / MSSql | A con nota |
| 8 | SQLite, HSQLDb, JavaDB, Firebird, Access | Embebidos o ligeros | Fichero local (sin contenedor) | A |
| 9 | Vertica, Exasol, Informix | Tienen imagen de comunidad | Ver tabla; si no levanta, driver shim -> Postgres | A / A-emu |
| 10 | Teradata, Netezza, Sybase, SybaseIQ, Ingres, VectorWise, AS400, MaxDB, SAPHana | Sin imagen: **driver shim** hacia Postgres/H2 (EMULADORES.md 2.3) y script falso para los cargadores masivos | Postgres / H2 | A-emu |

## 2. Entorno por motor

Anade cada servicio a `testdata/docker-compose.yml` (no crees otro compose), con volumen y `healthcheck`, y un script
de datos en `testdata/db/<motor>/init.sql` con la tabla de pruebas del patron (seccion 3). Puertos nuevos para no
chocar con los existentes (5433, 3307, 27018, 2121, 4566, 10000, 21051, 9000, 9870).

| Motor | Imagen | Puerto host | Usuario de laboratorio | Driver (Maven) |
|---|---|---|---|---|
| Oracle | `gvenzl/oracle-free:23-slim` | 1522 -> 1521 | `APP_USER=talend` / `APP_USER_PASSWORD=talend` (servicio `FREEPDB1`) | `com.oracle.database.jdbc:ojdbc8` |
| MSSql | `mcr.microsoft.com/mssql/server:2022-latest` (`ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD`) | 1434 -> 1433 | `sa` y una contrasena de laboratorio fuerte | `com.microsoft.sqlserver:mssql-jdbc` |
| DB2 | `icr.io/db2_community/db2` (`LICENSE=accept`, `privileged: true`) | 50001 -> 50000 | `db2inst1` | `com.ibm.db2:jcc` |
| Vertica | `vertica/vertica-ce` | 5434 | `dbadmin` | `com.vertica.jdbc:vertica-jdbc` |
| Exasol | `exasol/docker-db` (`privileged: true`) | 8564 | `sys` | `com.exasol:exasol-jdbc` |
| Informix | `icr.io/informix/informix-developer-database` | 9089 | `informix` | `com.ibm.informix:jdbc` |
| Firebird | `jacobalberty/firebird` | 3051 | `SYSDBA` | `org.firebirdsql.jdbc:jaybird` |
| SQLite | (fichero) | - | - | `org.xerial:sqlite-jdbc` |
| HSQLDb | (embebido) | - | - | `org.hsqldb:hsqldb` |
| JavaDB (Derby) | (embebido) | - | - | `org.apache.derby:derby` |
| Access | (fichero `.accdb`) | - | - | UCanAccess (`net.sf.ucanaccess:ucanaccess`) |
| Teradata, Netezza, Sybase, AS400, Ingres, SAPHana, MaxDB | ninguno | - | - | Los jar de cada fabricante |

Notas:

- **Memoria.** Oracle, DB2 y MSSql consumen 2 a 4 GB cada uno y la maquina tiene 13 GB con Studio abierto. Levanta
  **un motor cada vez** (`docker compose up -d oracle`), prueba todo ese motor y bajalo (`docker compose stop oracle`).
- **Drivers.** Los resuelve Studio al compilar: `talend_job_compile` con `installMissing: true`, o
  `talend_studio_install_artifact` con las coordenadas de la tabla (y la version que muestre `imports` de
  `talend_components_definition`). Si un driver no esta en Maven Central, se construye un driver shim con el mismo nombre de clase y coordenada (EMULADORES.md 2.3) y el motor pasa a A-emu.
- **Licencias.** Usa solo las imagenes de comunidad/desarrollo. Nunca subas imagenes, claves ni drivers propietarios
  al repositorio.
- **Compatibles por protocolo.** Redshift y Greenplum hablan el protocolo de Postgres; Aurora es MySQL o Postgres.
  Se prueban contra el contenedor correspondiente, **documentando** que es un sustituto y que no se ha probado contra
  el servicio real.

## 3. El patron de 12 escenarios por motor

Cada motor sigue el mismo guion. Los nombres de componente cambian (`tOracleOutput`, `tMSSqlOutput`...); el patron
no. Si un motor no tiene alguno de los componentes (p. ej. SQLite no tiene `SP`), se salta y se anota.

| # | Escenario | Componentes | Como se comprueba |
|---|---|---|---|
| S1 | Crear tabla y borrar | `Connection`, `Row` (DDL), `Close` | `Row` con `CREATE TABLE`; despues un `Input` la lee vacia |
| S2 | Insertar | `FixedFlowInput` -> `Output` (`TABLE_ACTION=DROP_CREATE`/`CREATE_IF_NOT_EXISTS`, `DATA_ACTION=INSERT`) | Leer de vuelta con `Input` en el mismo job (`SUBJOB_OK`) |
| S3 | Leer | `Input` -> `LogRow` | Salida exacta de las filas sembradas |
| S4 | Modificar y borrar | `Output` con `UPDATE`, `DELETE`, `INSERT_OR_UPDATE`, `UPDATE_OR_INSERT` y las claves (`UPDATE_KEY`, `DELETE_KEY`) | Leer de vuelta |
| S5 | Transacciones | `Connection` (`AUTO_COMMIT=false`) + `Commit` / `Rollback` explicitos | Con `Rollback` el dato anterior sigue; con `Commit`, el nuevo |
| S6 | Sentencia con resultado | `Row` con `PROPAGATE_RECORD_SET` o `USE_PREPAREDSTATEMENT` | La fila vuelve en el flujo |
| S7 | Rechazo | `Output` con una violacion de clave -> enlace `REJECT` -> `LogRow` | La fila mala sale por `REJECT` con `errorCode` y `errorMessage` |
| S8 | Carga masiva | `OutputBulk` + `BulkExec` (o `OutputBulkExec`) | **Requiere cliente** del motor (`sqlldr`, `bcp`, `psql`...): instalarlo en el contenedor o poner en el `PATH` un script falso del mismo nombre que valide los argumentos y cargue el fichero (A-emu) |
| S9 | Dimension lenta | `SCD` (tipos 1, 2 y 3) | Dos pasadas: la segunda cambia un atributo y se ve la version nueva y la cerrada |
| S10 | Procedimiento almacenado | `SP` (+ `tParseRecordSet` si devuelve un conjunto) | Procedimiento de `init.sql` que suma dos numeros |
| S11 | Utilidades | `LastInsertId`, `ColumnList`, `TableList` | Listas del esquema de pruebas |
| S12 | Errores | Contrasena mala, tabla inexistente, puerto cerrado | El job falla con un mensaje util (C7), no con un `ECONNREFUSED` pelado |

**Comprobar el resultado.** El campo `espera.consulta` de un escenario solo ejecuta SQL en el **Postgres de pruebas**.
Para los demas motores hay dos caminos; usa el primero salvo que haga falta el segundo:

1. **Dentro del propio job** (no cambia el arnes): tras el `Output`, un `SUBJOB_OK` hacia un `Input` del mismo motor
   -> `tLogRow`; la salida `espera.lineas` verifica los datos.
2. **Extender el arnes**: generalizar `consulta` para aceptar `{ motor, sql, valor }` y conectar con un cliente Bun de
   cada motor (`scripts/l5/` ya tiene el del Postgres). Si lo haces, con test y documentado en
   `docs/plan-de-pruebas/03-ejecucion-l5.md`.

### Parametros que se repiten en todos los motores

| Parametro | Notas |
|---|---|
| `HOST`, `PORT`, `DBNAME`/`SCHEMA`, `USER`, `PASS` | Literales Java (con comillas). La contrasena de laboratorio, nunca real |
| `USE_EXISTING_CONNECTION` + `CONNECTION` | Compartir conexion con `Connection`. `CONNECTION` referencia el nodo (`@uniqueName:conexion`) |
| `AUTO_COMMIT` | `true` por defecto en los escenarios; `false` solo para S5 |
| `TABLE` | El nombre de la tabla es un literal; algunos motores son sensibles a mayusculas (Oracle, DB2) |
| `TABLE_ACTION` | Lista cerrada, **sin comillas**: `NONE`, `DROP_CREATE`, `CREATE`, `CREATE_IF_NOT_EXISTS`, `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE` |
| `DATA_ACTION` | `INSERT`, `UPDATE`, `INSERT_OR_UPDATE`, `UPDATE_OR_INSERT`, `DELETE` |
| `MAPPING` | El id del mapeo del motor (`postgres_id`, `mysql_id`, `oracle_id`, `id_MSSQL`...); sale de `mappings/*.xml` o del `.item` de Studio |
| `FIELD_OPTIONS` | Tabla (cinco celdas por columna: `SCHEMA_COLUMN`, `UPDATE_KEY`, `DELETE_KEY`, `UPDATABLE`, `INSERTABLE`). Va en `tablas`, no en `parameters` |

Ids de mapeo verificados en `mappings/mapping_*.xml` (jar `org.talend.core.runtime` de Studio): `oracle_id`,
`id_MSSQL`, `mysql_id`, `postgres_id`, `teradata_id`, `vertica_id`, `redshift_id`, `greenplum_id`, `sybase_id`,
`informix_id`, `Exasol_id`, `sqlite_id`, `firebird_id`, `netezza_id`, `as400_id`, `access_id`. Para otro motor:
`unzip -p org.talend.core.runtime_*.jar mappings/mapping_<Motor>.xml | grep "<dbms "`. El valor guardado en el `.item`
lleva comillas (`"postgres_id"`); el bridge usa el id para poner el tipo de BD de cada columna al guardar el job.

## 4. Trampas especificas por motor

| Motor | Trampa | Que hacer |
|---|---|---|
| Oracle | Nombres en mayusculas; `VARCHAR2`; no hay `BOOLEAN` | Declarar las columnas en el esquema con longitud (`length`); comprobar `DROP_CREATE` |
| Oracle | `sqlldr` para `BulkExec` | Cliente en el contenedor (`gvenzl` lo incluye en la imagen completa) o script falso de `sqlldr` en el `PATH` (A-emu) |
| MSSql | Dos drivers (jTDS y Microsoft) segun `DB_VERSION`; `bcp` para bulk | Probar con `DB_VERSION` del driver Microsoft; S8 con `bcp` del contenedor (`mssql-tools`) o script falso |
| DB2 | Contenedor lento al arrancar (varios minutos) y exige privilegios | Esperar al `healthcheck`; S9 y S10 con sintaxis DB2 |
| Postgres / Greenplum / Redshift | Columnas `serial`, esquemas | `SCHEMA` literal; Greenplum `GPLoad` y `Redshift Unload/BulkExec` con un script falso del mismo nombre (A-emu) |
| MySQL / Aurora | Motor de tabla, `LastInsertId` | Reutilizar S11 |
| Sybase / Teradata / Netezza | Sin imagen | Driver shim hacia Postgres; `FastLoad`, `TPT`, `NzLoad`, `MultiLoad`, `TPump` con scripts falsos en el `PATH`. Ejecutado: A-emu; la ficha dice que no valida el dialecto |
| Embebidos (SQLite, HSQLDb, JavaDB) | La conexion es un fichero/URL, no hay contrasena | Un unico escenario con S1 a S5; ruta en `testdata/` |
| Access | Requiere UCanAccess (varias librerias) | `installMissing`; crear el `.accdb` con UCanAccess (`jdbc:ucanaccess://<ruta>;newdatabaseversion=V2010`) en `init` |
| Todos | Hilo de Studio ocupado al descargar drivers | `talend_studio_ui_dialogs`; ver SOLUCION seccion 4 |

## 5. Componentes `Configuration` y de Big Data dentro de `Databases`

Los `t*Configuration` (por ejemplo `tOracleConfiguration`, `tMysqlConfiguration`, `tJDBCConfiguration`) y los que
hablan con almacenes distintos (BigQuery, Cassandra, DynamoDB, HBase, Iceberg, Kudu, Snowflake, DeltaLake, CosmosDB)
pertenecen a las paletas de Big Data / Spark o a la nube: se prueban en [P08](P08-big-data-y-nosql.md),
[P06](P06-cloud-y-mensajeria.md) o [P10](P10-paletas-no-di.md). No los cuentes aqui.

## 6. Aceptacion de P03

- Por cada motor (A o A-emu): S1 a S12 pasan. Si un motor no tiene un componente (SQLite no tiene `SP`), se anota y se salta ese escenario; ninguno queda sin ejecutar por ser "dificil".
- Por cada motor en A-emu: la ficha indica el sustituto (H2 en que modo, driver shim hacia donde, script falso de que  cargador) y lo que NO demuestra. Un motor sin imagen no es excusa: se emula.
- Cero avisos de Studio sin explicar (el alineado de `dbType` ya lo resuelve el bridge; si un motor nuevo lo
  reactiva, comprueba que su `MAPPING` es un id valido).
- Fichas en `docs/fichas-componentes/databases.md`, un apartado por motor y una tabla de los componentes que lo
  forman con su nivel.
- El `testdata/docker-compose.yml` actualizado, cada servicio con `healthcheck`, y una nota en
  `docs/plan-de-pruebas/03-ejecucion-l5.md` sobre como levantarlo.
