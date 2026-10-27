# Catalogo: Databases

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

393 componentes · 250 compilan (L4) · 15 con escenario L5 que pasa o esta definido.

Subfamilias: Databases · Databases/BigQuery · Databases/Cassandra · Databases/DB Specifics/AS400 · Databases/DB Specifics/Access · Databases/DB Specifics/Amazon/Aurora · Databases/DB Specifics/Amazon/Oracle · Databases/DB Specifics/Amazon/Redshift · Databases/DB Specifics/Azure/Synapse Analytics · Databases/DB Specifics/Cosmos DB · Databases/DB Specifics/DB2 · Databases/DB Specifics/EXASolution · Databases/DB Specifics/FireBird · Databases/DB Specifics/Greenplum · Databases/DB Specifics/HSQLDb · Databases/DB Specifics/Hive · Databases/DB Specifics/Informix · Databases/DB Specifics/Ingres · Databases/DB Specifics/JDBC · Databases/DB Specifics/JavaDb · Databases/DB Specifics/MS_SQL_Server · Databases/DB Specifics/MaxDB · Databases/DB Specifics/MySQL · Databases/DB Specifics/Netezza · Databases/DB Specifics/Oracle · Databases/DB Specifics/PostgreSQL · Databases/DB Specifics/SAP Hana · Databases/DB Specifics/SQLite · Databases/DB Specifics/Sybase · Databases/DB Specifics/Teradata · Databases/DB Specifics/VectorWise · Databases/DB Specifics/Vertica · Databases/DB_JDBC · Databases/DeltaLake · Databases/DynamoDB · Databases/HBase · Databases/Hive · Databases/Iceberg · Databases/Kudu · Databases/MapRDB · Databases/MongoDB · Databases/MySQL · Databases/OpenLakehouse · Databases/Oracle · Databases/Redshift · Databases/Snowflake · Databases/Teradata

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAccessBulkExec` | 5 | DI | 18/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessConnection` | 5 | DI | 11/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 11 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAccessInput` | 5 | DI | 18/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAccessOutput` | 5 | DI | 23/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAccessOutputBulk` | 5 | DI | 9/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessOutputBulkExec` | 5 | DI | 22/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAccessRow` | 5 | DI | 21/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAmazonAuroraClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraConnection` | 5 | DI | 16/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraInput` | 5 | DI | 24/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraInvalidRows` | 5 | DI | 28/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraOutput` | 5 | DI | 34/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraRow` | 5 | DI | 23/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonAuroraValidRows` | 5 | DI | 28/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleConnection` | 5 | DI | 21/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAmazonOracleInput` | 5 | DI | 29/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleOutput` | 5 | DI | 38/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonOracleRow` | 5 | DI | 29/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAmazonRedshiftManage` | 5 | DI | 37/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 32 | ninguno | sin medir | sin escenario | P03 |
| `tAS400CDC` | 5 | DI | 28/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Close` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Commit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Connection` | 5 | DI | 12/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Input` | 5 | DI | 21/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400LastInsertId` | 5 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Output` | 5 | DI | 31/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Rollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAS400Row` | 5 | DI | 24/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAthenaConfiguration` | 13 | SPARK | 9/2 | SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tAthenaInput` | 13 | SPARK | 5/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAzureSynapseBulkExec` | 5 | DI | 70/30 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseConnection` | 5 | DI | 20/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tAzureSynapseInput` | 5 | DI | 26/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseOutput` | 5 | DI | 39/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tAzureSynapseRow` | 5 | DI | 30/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tBigQueryConfiguration` | 13 | SPARK | 9/6 | SUBJOB_OK COMPONENT_OK | - | Google: emuladores | n/a | n/a | P10 |
| `tBigQueryConfiguration` | 13 | SPARKSTREAMING | 9/6 | SUBJOB_OK COMPONENT_OK | - | Google: emuladores | n/a | n/a | P10 |
| `tBigQueryInput` | 13 | SPARK | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Google: emuladores | n/a | n/a | P10 |
| `tBigQueryInput` | 13 | SPARKSTREAMING | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Google: emuladores | n/a | n/a | P10 |
| `tBigQueryOutput` | 13 | SPARK | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Google: emuladores | n/a | n/a | P10 |
| `tBigQueryOutput` | 13 | SPARKSTREAMING | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Google: emuladores | n/a | n/a | P10 |
| `tCassandraConfiguration` | 13 | SPARK | 11/5 | SUBJOB_OK COMPONENT_OK | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tCassandraConfiguration` | 13 | SPARKSTREAMING | 11/5 | SUBJOB_OK COMPONENT_OK | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tCassandraInput` | 13 | SPARK | 12/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tCassandraLookupInput` | 13 | SPARKSTREAMING | 23/8 | FLOW | 3 | NoSQL: contenedor | n/a | n/a | P10 |
| `tCassandraOutput` | 13 | SPARK | 28/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tCassandraOutput` | 13 | SPARKSTREAMING | 28/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tCosmosDBBulkLoad` | 8 | DI | 28/6 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P06 |
| `tCosmosDBClose` | 8 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tCosmosDBConnection` | 8 | DI | 19/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P06 |
| `tCosmosDBInput` | 8 | DI | 32/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P06 |
| `tCosmosDBOutput` | 8 | DI | 42/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P06 |
| `tCosmosDBRow` | 8 | DI | 22/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P06 |
| `tCosmosDBWriteConf` | 8 | DI | 33/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | ninguno | falla | sin escenario | P06 |
| `tCreateTable` | 5 | DI | 75/39 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P03 |
| `tDB2BulkExec` | 5 | DI | 54/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2CDC` | 5 | DI | 22/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Close` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Commit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Connection` | 5 | DI | 15/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Input` | 5 | DI | 22/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Output` | 5 | DI | 35/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Rollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2Row` | 5 | DI | 25/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2SCD` | 5 | DI | 46/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2SCDELT` | 5 | DI | 34/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDB2SP` | 5 | DI | 19/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tDeltaLakeInput` | 13 | SPARK | 17/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tDeltaLakeOutput` | 13 | SPARK | 42/4 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tDynamoDBConfiguration` | 13 | SPARK | 8/2 | SUBJOB_OK COMPONENT_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tDynamoDBConfiguration` | 13 | SPARKSTREAMING | 15/2 | SUBJOB_OK COMPONENT_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tDynamoDBInput` | 13 | SPARK | 19/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tDynamoDBLookupInput` | 13 | SPARKSTREAMING | 23/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tDynamoDBOutput` | 13 | SPARK | 16/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tDynamoDBOutput` | 13 | SPARKSTREAMING | 15/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tExasolBulkExec` | 5 | DI | 57/27 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tExasolClose` | 5 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tExasolCommit` | 5 | DI | 2/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tExasolConnection` | 5 | DI | 11/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tExasolInput` | 5 | DI | 21/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tExasolOutput` | 5 | DI | 26/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tExasolRollback` | 5 | DI | 2/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tExasolRow` | 5 | DI | 24/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tFirebirdClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tFirebirdCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tFirebirdConnection` | 5 | DI | 11/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tFirebirdInput` | 5 | DI | 19/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tFirebirdOutput` | 5 | DI | 26/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tFirebirdRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tFirebirdRow` | 5 | DI | 22/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumBulkExec` | 5 | DI | 27/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumConnection` | 5 | DI | 14/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumGPLoad` | 5 | DI | 41/25 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumInput` | 5 | DI | 23/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumOutput` | 5 | DI | 29/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumOutputBulk` | 5 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumOutputBulkExec` | 5 | DI | 26/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumRow` | 5 | DI | 24/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tGreenplumSCD` | 5 | DI | 48/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tHBaseConfiguration` | 13 | SPARK | 16/8 | SUBJOB_OK COMPONENT_OK | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseConfiguration` | 13 | SPARKSTREAMING | 25/14 | SUBJOB_OK COMPONENT_OK | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseDeleteRows` | 13 | SPARK | 11/7 | FLOW SUBJOB_OK ITERATE SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseInput` | 13 | SPARK | 14/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseLookupInput` | 13 | SPARKSTREAMING | 28/2 | FLOW | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseOutput` | 13 | SPARK | 17/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHBaseOutput` | 13 | SPARKSTREAMING | 15/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tHiveClose` | 10 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHiveConfiguration` | 13 | SPARK | 12/9 | SUBJOB_OK COMPONENT_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveConfiguration` | 13 | SPARKSTREAMING | 11/8 | SUBJOB_OK COMPONENT_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveConfiguration` | 13 | STRUCTUREDSTREAMING | 10/8 | SUBJOB_OK COMPONENT_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveConnection` | 10 | DI | 78/63 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | con escenario | P08 |
| `tHiveCreateTable` | 10 | DI | 112/86 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHiveIn` | 10 | DI | 34/29 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHiveInput` | 10 | DI | 93/69 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | con escenario | P08 |
| `tHiveInput` | 13 | SPARK | 14/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveInput` | 13 | SPARKSTREAMING | 14/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveLoad` | 10 | DI | 91/68 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | con escenario | P08 |
| `tHiveOutput` | 13 | SPARK | 18/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveOutput` | 13 | SPARKSTREAMING | 18/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveOutput` | 13 | STRUCTUREDSTREAMING | 16/3 | FLOW ITERATE | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveRow` | 10 | DI | 90/67 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | con escenario | P08 |
| `tHiveStreamInput` | 13 | STRUCTUREDSTREAMING | 20/11 | FLOW SUBJOB_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseConfiguration` | 13 | SPARK | 17/11 | SUBJOB_OK COMPONENT_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseConfiguration` | 13 | SPARKSTREAMING | 18/12 | SUBJOB_OK COMPONENT_OK | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseInput` | 13 | SPARK | 14/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseInput` | 13 | SPARKSTREAMING | 14/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseOutput` | 13 | SPARK | 18/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHiveWarehouseOutput` | 13 | SPARKSTREAMING | 18/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHSQLDbInput` | 5 | DI | 19/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tHSQLDbOutput` | 5 | DI | 25/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tHSQLDbRow` | 5 | DI | 24/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tIcebergCatalog` | 13 | SPARK | 15/1 | SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tIcebergCatalog` | 13 | STRUCTUREDSTREAMING | 8/0 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tIcebergInput` | 13 | SPARK | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tIcebergOutput` | 13 | SPARK | 14/4 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tIcebergOutput` | 13 | STRUCTUREDSTREAMING | 10/2 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tIcebergSql` | 13 | SPARK | 10/7 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tIcebergStreamInput` | 13 | STRUCTUREDSTREAMING | 8/5 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tIcebergTable` | 13 | SPARK | 44/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tInformixBulkExec` | 5 | DI | 29/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixCDC` | 5 | DI | 23/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixConnection` | 5 | DI | 15/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixInput` | 5 | DI | 20/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixOutput` | 5 | DI | 33/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixOutputBulk` | 5 | DI | 14/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixOutputBulkExec` | 5 | DI | 35/24 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixRow` | 5 | DI | 25/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixSCD` | 5 | DI | 47/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tInformixSP` | 5 | DI | 19/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresBulkExec` | 5 | DI | 28/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | falla | sin escenario | P03 |
| `tIngresClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresConnection` | 5 | DI | 11/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresInput` | 5 | DI | 18/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresOutput` | 5 | DI | 26/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresOutputBulk` | 5 | DI | 8/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresOutputBulkExec` | 5 | DI | 29/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresRow` | 5 | DI | 22/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tIngresSCD` | 5 | DI | 46/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tJavaDBInput` | 5 | DI | 19/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tJavaDBOutput` | 5 | DI | 24/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tJavaDBRow` | 5 | DI | 23/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tJDBCColumnList` | 5 | DI | 18/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tJDBCConfiguration` | 13 | SPARK | 18/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCConfiguration` | 13 | SPARKSTREAMING | 18/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCInput` | 13 | SPARK | 28/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCLookupInput` | 13 | SPARKSTREAMING | 29/9 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCOutput` | 13 | SPARK | 30/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCOutput` | 13 | SPARKSTREAMING | 30/9 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tJDBCSCDELT` | 5 | DI | 40/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tJDBCTableList` | 5 | DI | 19/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tKuduConfiguration` | 13 | SPARK | 7/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tKuduInput` | 13 | SPARK | 16/8 | FLOW ITERATE SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tKuduOutput` | 13 | SPARK | 18/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tMapRDBConfiguration` | 13 | SPARK | 23/13 | SUBJOB_OK COMPONENT_OK | - | ninguno | n/a | n/a | P10 |
| `tMapRDBConfiguration` | 13 | SPARKSTREAMING | 23/12 | SUBJOB_OK COMPONENT_OK | - | ninguno | n/a | n/a | P10 |
| `tMapRDBInput` | 13 | SPARK | 12/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMapRDBLookupInput` | 13 | SPARKSTREAMING | 13/4 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tMapRDBOutput` | 13 | SPARK | 15/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMapRDBOutput` | 13 | SPARKSTREAMING | 14/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMaxDBInput` | 5 | DI | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tMaxDBOutput` | 5 | DI | 22/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tMaxDBRow` | 5 | DI | 20/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tMongoDBConfiguration` | 13 | SPARK | 21/5 | SUBJOB_OK COMPONENT_OK | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBConfiguration` | 13 | SPARKSTREAMING | 20/4 | SUBJOB_OK COMPONENT_OK | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBInput` | 13 | SPARK | 12/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBInput` | 13 | SPARKSTREAMING | 12/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBLookupInput` | 13 | SPARKSTREAMING | 9/5 | FLOW | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBOutput` | 13 | SPARK | 18/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMongoDBOutput` | 13 | SPARKSTREAMING | 11/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tMSSqlBulkExec` | 5 | DI | 39/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlCDC` | 5 | DI | 26/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlColumnList` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlConnection` | 5 | DI | 23/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlInput` | 5 | DI | 31/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlInvalidRows` | 5 | DI | 29/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlLastInsertId` | 5 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlOutput` | 5 | DI | 46/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlOutputBulk` | 5 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlOutputBulkExec` | 5 | DI | 29/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlRow` | 5 | DI | 35/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlSCD` | 5 | DI | 50/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlSP` | 5 | DI | 23/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlTableList` | 5 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMSSqlValidRows` | 5 | DI | 29/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlBulkExec` | 5 | DI | 24/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlCDC` | 5 | DI | 24/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlColumnList` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlConfiguration` | 13 | SPARK | 18/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMysqlConfiguration` | 13 | SPARKSTREAMING | 18/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMysqlConnection` | 5 | DI | 16/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tMysqlInput` | 5 | DI | 24/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tMysqlInput` | 13 | SPARK | 27/8 | FLOW ITERATE SUBJOB_OK | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMySQLInvalidRows` | 5 | DI | 29/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P03 |
| `tMysqlLastInsertId` | 5 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlLookupInput` | 13 | SPARKSTREAMING | 28/8 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMysqlOutput` | 5 | DI | 34/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tMysqlOutput` | 13 | SPARK | 27/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMysqlOutput` | 13 | SPARKSTREAMING | 27/6 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tMysqlOutputBulk` | 5 | DI | 14/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlOutputBulkExec` | 5 | DI | 28/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlRow` | 5 | DI | 26/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tMysqlSCD` | 5 | DI | 48/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlSCDELT` | 5 | DI | 32/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlSP` | 5 | DI | 20/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMysqlTableList` | 5 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tMySQLValidRows` | 5 | DI | 29/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P03 |
| `tNetezzaBulkExec` | 5 | DI | 24/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaConnection` | 5 | DI | 13/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaInput` | 5 | DI | 22/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaNzLoad` | 5 | DI | 28/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaOutput` | 5 | DI | 26/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaRow` | 5 | DI | 23/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tNetezzaSCD` | 5 | DI | 48/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleBulkExec` | 5 | DI | 53/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleCDC` | 5 | DI | 37/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleCDCOutput` | 5 | DI | 18/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleConfiguration` | 13 | SPARK | 28/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleConfiguration` | 13 | SPARKSTREAMING | 27/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleConnection` | 5 | DI | 32/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleInput` | 5 | DI | 34/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleInput` | 13 | SPARK | 33/10 | FLOW ITERATE SUBJOB_OK | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleInvalidRows` | 5 | DI | 37/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleLookupInput` | 13 | SPARKSTREAMING | 34/9 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleOutput` | 5 | DI | 45/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleOutput` | 13 | SPARK | 35/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleOutput` | 13 | SPARKSTREAMING | 34/9 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tOracleOutputBulk` | 5 | DI | 19/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleOutputBulkExec` | 5 | DI | 53/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleRow` | 5 | DI | 33/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleSCD` | 5 | DI | 54/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleSCDELT` | 5 | DI | 43/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleSP` | 5 | DI | 28/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleTableList` | 5 | DI | 6/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tOracleValidRows` | 5 | DI | 37/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tParseRecordSet` | 4 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tPostgresqlBulkExec` | 5 | DI | 32/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlCDC` | 5 | DI | 25/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlConnection` | 5 | DI | 17/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlInput` | 5 | DI | 26/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlInvalidRows` | 5 | DI | 29/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlOutput` | 5 | DI | 38/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlOutputBulk` | 5 | DI | 12/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlOutputBulkExec` | 5 | DI | 31/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlRow` | 5 | DI | 27/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | con escenario | P03 |
| `tPostgresqlSCD` | 5 | DI | 48/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlSCDELT` | 5 | DI | 33/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tPostgresqlValidRows` | 5 | DI | 29/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tRedshiftBulkExec` | 5 | DI | 57/33 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tRedshiftCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tRedshiftConfiguration` | 13 | SPARK | 17/9 | SUBJOB_OK COMPONENT_OK | 1 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftConfiguration` | 13 | SPARKSTREAMING | 26/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftConnection` | 5 | DI | 20/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftInput` | 5 | DI | 29/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftInput` | 13 | SPARK | 28/11 | FLOW ITERATE SUBJOB_OK | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftLookupInput` | 13 | SPARKSTREAMING | 31/9 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftOutput` | 5 | DI | 36/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftOutput` | 13 | SPARK | 36/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftOutput` | 13 | SPARKSTREAMING | 35/11 | FLOW | - | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tRedshiftOutputBulk` | 5 | DI | 38/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 53 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftOutputBulkExec` | 5 | DI | 63/31 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 53 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tRedshiftRow` | 5 | DI | 27/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tRedshiftUnload` | 5 | DI | 41/24 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tSAPHanaClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P03 |
| `tSAPHanaCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P03 |
| `tSAPHanaConnection` | 5 | DI | 11/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P03 |
| `tSAPHanaInput` | 5 | DI | 20/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P03 |
| `tSAPHanaInvalidRows` | 5 | DI | 27/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P03 |
| `tSAPHanaOutput` | 5 | DI | 30/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P03 |
| `tSAPHanaRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P03 |
| `tSAPHanaRow` | 5 | DI | 23/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P03 |
| `tSAPHanaValidRows` | 5 | DI | 27/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P03 |
| `tSnowflakeConfiguration` | 13 | SPARK | 15/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSnowflakeInput` | 13 | SPARK | 24/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSnowflakeOutput` | 13 | SPARK | 21/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSQLiteClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSQLiteCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSQLiteConnection` | 5 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tSQLiteInput` | 5 | DI | 13/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSQLiteOutput` | 5 | DI | 21/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSQLiteRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSQLiteRow` | 5 | DI | 17/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseBulkExec` | 5 | DI | 28/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseCDC` | 5 | DI | 22/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseConnection` | 5 | DI | 14/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseInput` | 5 | DI | 22/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseIQBulkExec` | 5 | DI | 58/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseIQOutputBulkExec` | 5 | DI | 27/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseOutput` | 5 | DI | 32/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseOutputBulk` | 5 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseOutputBulkExec` | 5 | DI | 31/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseRow` | 5 | DI | 26/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseSCD` | 5 | DI | 46/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseSCDELT` | 5 | DI | 32/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tSybaseSP` | 5 | DI | 21/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataCDC` | 5 | DI | 19/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataConfiguration` | 13 | SPARK | 17/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataConfiguration` | 13 | SPARKSTREAMING | 16/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataConnection` | 5 | DI | 14/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataFastExport` | 5 | DI | 28/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataFastLoad` | 5 | DI | 13/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataFastLoadUtility` | 5 | DI | 21/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataInput` | 5 | DI | 21/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataInput` | 13 | SPARK | 28/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataLookupInput` | 13 | SPARKSTREAMING | 28/7 | FLOW | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataMultiLoad` | 5 | DI | 22/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataOutput` | 5 | DI | 30/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataOutput` | 13 | SPARK | 28/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataOutput` | 13 | SPARKSTREAMING | 27/6 | FLOW | 2 | BD: contenedor, H2 o driver shim | n/a | n/a | P10 |
| `tTeradataRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataRow` | 5 | DI | 24/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataSCD` | 5 | DI | 42/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataSCDELT` | 5 | DI | 30/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataTPTExec` | 5 | DI | 39/28 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataTPTUtility` | 5 | DI | 42/27 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tTeradataTPump` | 5 | DI | 22/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVectorWiseCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVectorWiseConnection` | 5 | DI | 11/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tVectorWiseInput` | 5 | DI | 18/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tVectorWiseOutput` | 5 | DI | 28/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tVectorWiseRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVectorWiseRow` | 5 | DI | 22/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | sin medir | sin escenario | P03 |
| `tVerticaBulkExec` | 5 | DI | 48/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaCommit` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaConnection` | 5 | DI | 13/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaInput` | 5 | DI | 19/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaOutput` | 5 | DI | 39/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaOutputBulk` | 5 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaOutputBulkExec` | 5 | DI | 40/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaRollback` | 5 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaRow` | 5 | DI | 25/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tVerticaSCD` | 5 | DI | 47/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
