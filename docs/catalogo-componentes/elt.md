# Catalogo: ELT

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

49 componentes · 0 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: ELT · ELT/Combined SQL · ELT/Map/DB_JDBC · ELT/Map/Greenplum · ELT/Map/Hive · ELT/Map/MSSql · ELT/Map/MySQL · ELT/Map/Netezza · ELT/Map/Oracle · ELT/Map/PostgreSQL · ELT/Map/SAP · ELT/Map/Sybase · ELT/Map/Teradata · ELT/Map/Vertica · ELT/SQLTemplate

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tCombinedSQLAggregate` | 6 | DI | 4/1 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tCombinedSQLFilter` | 6 | DI | 6/2 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tCombinedSQLInput` | 6 | DI | 6/0 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tCombinedSQLOutput` | 6 | DI | 23/17 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tELTGreenplumInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTGreenplumMap` | 6 | DI | 14/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTGreenplumOutput` | 6 | DI | 12/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTHiveInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTHiveMap` | 6 | DI | 81/65 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTHiveOutput` | 6 | DI | 13/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTInput` | 5 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P03 |
| `tELTMap` | 5 | DI | 15/7 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P03 |
| `tELTMSSqlInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTMSSqlMap` | 6 | DI | 18/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTMSSqlOutput` | 6 | DI | 13/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTMysqlInput` | 6 | DI | 3/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTMysqlMap` | 6 | DI | 15/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTMysqlOutput` | 6 | DI | 11/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTNetezzaInput` | 6 | DI | 3/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTNetezzaMap` | 6 | DI | 14/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTNetezzaOutput` | 6 | DI | 22/3 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTNode` | 6 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTOracleInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTOracleMap` | 6 | DI | 21/6 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTOracleOutput` | 6 | DI | 24/3 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTOracleUniteMap` | 6 | DI | 16/6 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTOutput` | 5 | DI | 17/2 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P03 |
| `tELTPostgresqlInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTPostgresqlMap` | 6 | DI | 15/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTPostgresqlOutput` | 6 | DI | 13/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTSAPInput` | 12 | DI | 3/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P11 |
| `tELTSAPMap` | 12 | DI | 46/28 | TABLE FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P11 |
| `tELTSybaseInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTSybaseMap` | 6 | DI | 15/5 | TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTSybaseOutput` | 6 | DI | 12/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTTeradataInput` | 6 | DI | 3/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTTeradataMap` | 6 | DI | 15/6 | TABLE TABLE_REF SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTTeradataOutput` | 6 | DI | 17/4 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTTeradataUniteMap` | 6 | DI | 12/5 | TABLE TABLE_REF SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTVerticaInput` | 6 | DI | 4/0 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTVerticaMap` | 6 | DI | 14/5 | TABLE TABLE_REF ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tELTVerticaOutput` | 6 | DI | 15/1 | FLOW TABLE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: Postgres/MySQL/H2 | sin medir | sin escenario | P04 |
| `tSQLTemplate` | 6 | DI | 24/19 | TABLE FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF ITERATE | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateAggregate` | 6 | DI | 27/21 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateCommit` | 6 | DI | 21/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateFilterColumns` | 6 | DI | 26/20 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateFilterRows` | 6 | DI | 26/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateMerge` | 6 | DI | 38/25 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
| `tSQLTemplateRollback` | 6 | DI | 21/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P04 |
