# P08 · Big Data y NoSQL

Nivel 10 del catalogo (74 componentes Standard): Hive, Impala, HDFS, Mongo, Cassandra, HBase, Iceberg, Sqoop, HCatalog
y DBFS. Para una migracion bancaria el interes real es mover datos hacia y desde un lago de datos (HDFS/Hive) y leer
fuentes documentales (Mongo). Aqui hay **mucho ya hecho**: Hive, Impala, HDFS y Mongo tienen contenedor y escenarios.

- Catalogo: [databases-nosql](../catalogo-componentes/databases-nosql.md), [databases](../catalogo-componentes/databases.md)
  (Hive, Impala, Cassandra, HBase, Iceberg), [big-data](../catalogo-componentes/big-data.md),
  [file](../catalogo-componentes/file.md) (HDFS, Sqoop), [elasticsearch](../catalogo-componentes/elasticsearch.md).
- Suites: `bases de datos` para Mongo/Cassandra/HBase; nueva `bigdata` para HDFS/Hive/Impala/Sqoop/Iceberg
  (anadirla a `SCENARIO_SUITES`).
- Servicios existentes en `testdata/docker-compose.yml`: Hive (10000), Impala emulado (21051), HDFS (9000/9870),
  Mongo (27018).

## 1. Subfamilias y sustituto

| Subfamilia | Componentes | Servicio / sustituto | Estado |
|---|---|---|---|
| Mongo | `tMongoDBConnection/Input/Output/Row/Close/BulkLoad`, `tMongoDBGridFS*` (Delete, Get, List, Properties, Put) | `mongo:7` | Input/Output/Connection/Close con L5; faltan `Row`, `BulkLoad` y todos los `GridFS` |
| HDFS | `tHDFSConnection/Input/Output/OutputRaw/Put/Get/Delete/Exist/List/Copy/Compare/Rename/Properties/RowCount` | `apache/hadoop:3.3.6` (ya en compose) | Solo `tHDFSPut` |
| Hive | `tHiveConnection/Input/Row/Load/Close/CreateTable/In` | `apache/hive:4.0.1` (ya en compose) | Con L5 salvo `CreateTable` |
| Impala | `tImpalaConnection/Input/Output/Row/Load/CreateTable/Close` | Emulado sobre Hive (puerto 21051) | Con L5: `Connection/Input/Row` |
| Cassandra | `tCassandraConnection/Input/Output/Row/Close/BulkExec/OutputBulk/OutputBulkExec` | `cassandra:4` | Sin escenario |
| HBase | `tHBaseConnection/Input/Output/Close/Table/Namespace/DeleteRows` | `harisekhon/hbase` | Sin escenario |
| Iceberg | `tIcebergConnection/Catalog/Table/Input/Output/Row/Merge/Close` | Catalogo Hadoop local sobre ficheros | Sin escenario |
| Sqoop | `tSqoopImport/Export/ImportAllTables/Merge` | Hadoop local + Postgres | Sin escenario |
| HCatalog | `tHCatalogInput/Output/Load/Operation` | Hive Metastore del contenedor Hive | Sin escenario |
| DBFS (Databricks) | `tDBFSConnection/Get/Put` | Servidor HTTP falso de la API de DBFS | Sin escenario |

## 2. Orden de trabajo

1. **Mongo completo** (ya hay contenedor): `Row`, `BulkLoad` y los cinco `GridFS`.
2. **HDFS completo** con el namenode existente: todos los `tHDFS*` menos `Put`.
3. **Hive / Impala**: `CreateTable`, `Output`, `Load` de Impala.
4. **Cassandra, HBase** (contenedores nuevos, uno cada vez).
5. **Iceberg** (local), **HCatalog** (metastore de Hive), **Sqoop** (Hadoop local + Postgres).
6. **DBFS** (servidor falso).

## 3. Escenarios

**Documental (Mongo, Cassandra)**: `Connection -> Output (insertar 4 documentos) -> Input con filtro -> LogRow -> Row
(borrar) -> Input vacio -> Close`. Para Mongo: `tMongoDBGridFSPut` sube un fichero, `List`/`Properties` lo describen,
`Get` lo baja y `tFileCompare` lo compara; `Delete` lo borra.

**Sistema de ficheros distribuido (HDFS, DBFS)**: `Connection -> Put -> List -> Exist -> Properties -> RowCount ->
Copy -> Rename -> Get -> Compare -> Delete`. Cada paso comprueba su salida. Hay que sembrar el HDFS con un directorio de
trabajo propio por escenario.

**Almacen SQL sobre ficheros (Hive, Impala, Iceberg)**: `CreateTable -> Load (desde HDFS) -> Input -> LogRow`; luego
`Output` y volver a leer. Para Iceberg: crear catalogo y tabla, `Output`, `Merge` y leer el estado resultante.

**Intercambio con relacional (Sqoop)**: `tSqoopImport` Postgres -> HDFS y `tSqoopExport` HDFS -> Postgres; comprobar
filas en origen y destino. `ImportAllTables` y `Merge` con dos tablas pequenas.

## 4. Trampas

| Trampa | Que hacer |
|---|---|
| Hive tarda en arrancar (minutos) | Esperar al `healthcheck`; no lanzar la suite antes |
| Memoria | Hive, HDFS y Cassandra juntos no caben: levantar por escenario |
| HDFS en Windows: permisos y `winutils` | Usar el namenode del contenedor; el job habla por red, no por disco local |
| Jar de Hadoop/Hive muy grandes | `installMissing`; la primera compilacion descarga cientos de MB |
| Mongo `tMongoDBInput` y tipos `ObjectId`/fechas | Mapear a `String`/`Date` con patron; documentar |
| `tMongoDBBulkLoad` exige `mongoimport` | Instalar `mongoimport` en el `PATH` (MongoDB Database Tools) o un script falso del mismo nombre que cargue el fichero |
| `tCassandraBulkExec` exige `sstableloader` | Script falso del mismo nombre o el binario del contenedor |
| Sqoop requiere el cliente `sqoop` | Cliente de Sqoop local o script falso que ejecute el trasvase con JDBC |
| Impala emulado no es Impala | Anotar que no valida el dialecto especifico de Impala |

## 5. Aceptacion de P08

- Los 74 componentes ejecutados (A con Mongo/HDFS/Hive/Cassandra/HBase; A-emu con Impala, Iceberg, Sqoop, DBFS).
- Cada ficha dice que servicio se uso y que no demuestra (rendimiento a escala, seguridad Kerberos, particionado).
- Contenedores nuevos con `healthcheck`; suite `bigdata` declarada y documentada.
- Fichas en `docs/fichas-componentes/databases-nosql.md`, `big-data.md`.
