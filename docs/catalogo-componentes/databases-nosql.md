# Catalogo: Databases NoSQL

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

35 componentes · 24 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: Databases NoSQL/Cassandra · Databases NoSQL/DynamoDB (Deprecated) · Databases NoSQL/HBase · Databases NoSQL/MapRDB · Databases NoSQL/MongoDB

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tCassandraBulkExec` | 10 | DI | 27/20 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraClose` | 10 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraConnection` | 10 | DI | 10/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraInput` | 10 | DI | 17/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraOutput` | 10 | DI | 39/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraOutputBulk` | 10 | DI | 25/21 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraOutputBulkExec` | 10 | DI | 31/23 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tCassandraRow` | 10 | DI | 17/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tDynamoDBV1Input` | 8 | DI | 35/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 18 | AWS: LocalStack/moto | sin medir | sin escenario | P06 |
| `tDynamoDBV1Output` | 8 | DI | 31/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 18 | AWS: LocalStack/moto | sin medir | sin escenario | P06 |
| `tHBaseClose` | 10 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | falla | sin escenario | P08 |
| `tHBaseConnection` | 10 | DI | 15/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tHBaseDeleteRows` | 10 | DI | 21/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tHBaseInput` | 10 | DI | 30/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tHBaseNamespace` | 10 | DI | 19/9 | SUBJOB_OK SUBJOB_ERROR COMPONENT_OK | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tHBaseOutput` | 10 | DI | 30/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tHBaseTable` | 10 | DI | 22/10 | SUBJOB_OK SUBJOB_ERROR COMPONENT_OK | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMapRDBClose` | 5 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P03 |
| `tMapRDBConnection` | 5 | DI | 24/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P03 |
| `tMapRDBInput` | 5 | DI | 39/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P03 |
| `tMapRDBOutput` | 5 | DI | 39/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P03 |
| `tMapROjaiInput` | 5 | DI | 10/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P03 |
| `tMapROjaiOutput` | 5 | DI | 15/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P03 |
| `tMongoDBBulkLoad` | 10 | DI | 40/7 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBClose` | 10 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | falla | pendiente | P08 |
| `tMongoDBConnection` | 10 | DI | 25/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | NoSQL: contenedor | sin medir | pendiente | P08 |
| `tMongoDBGridFSDelete` | 10 | DI | 29/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBGridFSGet` | 10 | DI | 32/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBGridFSList` | 10 | DI | 29/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBGridFSProperties` | 10 | DI | 30/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBGridFSPut` | 10 | DI | 28/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBInput` | 10 | DI | 39/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | pendiente | P08 |
| `tMongoDBOutput` | 10 | DI | 48/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | pendiente | P08 |
| `tMongoDBRow` | 10 | DI | 28/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | compila | sin escenario | P08 |
| `tMongoDBWriteConf` | 10 | DI | 39/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | NoSQL: contenedor | falla | sin escenario | P08 |
