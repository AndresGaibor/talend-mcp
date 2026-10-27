# Catalogo: Big Data

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

41 componentes · 0 compilan (L4) · 3 con escenario L5 que pasa o esta definido.

Subfamilias: Big Data/DBFS · Big Data/Google BigQuery · Big Data/Google Storage · Big Data/HCatalog · Big Data/Iceberg · Big Data/Impala · Big Data/Spark · Big Data/Spark Streaming · Big Data/Structured Streaming

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tBigQueryBulkExec` | 8 | DI | 38/25 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 36 | Google: emuladores | sin medir | sin escenario | P06 |
| `tBigQueryInput` | 8 | DI | 27/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 14 | Google: emuladores | sin medir | sin escenario | P06 |
| `tBigQueryOutput` | 8 | DI | 49/34 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tBigQueryOutputBulk` | 8 | DI | 18/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Google: emuladores | sin medir | sin escenario | P06 |
| `tBigQuerySQLRow` | 8 | DI | 23/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 12 | Google: emuladores | sin medir | sin escenario | P06 |
| `tDBFSConnection` | 10 | DI | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tDBFSGet` | 10 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tDBFSPut` | 10 | DI | 10/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tGSBucketCreate` | 8 | DI | 15/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSBucketDelete` | 8 | DI | 12/4 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSBucketExist` | 8 | DI | 12/4 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSBucketList` | 8 | DI | 10/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSClose` | 8 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSConnection` | 8 | DI | 8/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 33 | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSCopy` | 8 | DI | 20/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSDelete` | 8 | DI | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSGet` | 8 | DI | 18/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSList` | 8 | DI | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Google: emuladores | sin medir | sin escenario | P06 |
| `tGSPut` | 8 | DI | 17/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Google: emuladores | sin medir | sin escenario | P06 |
| `tHCatalogInput` | 10 | DI | 35/27 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHCatalogLoad` | 10 | DI | 24/20 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHCatalogOperation` | 10 | DI | 52/47 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHCatalogOutput` | 10 | DI | 39/30 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tIcebergCatalog` | 10 | DI | 8/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergClose` | 10 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergConnection` | 10 | DI | 5/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergInput` | 10 | DI | 10/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergMerge` | 10 | DI | 19/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergOutput` | 10 | DI | 10/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergRow` | 10 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tIcebergTable` | 10 | DI | 35/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P08 |
| `tImpalaClose` | 10 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tImpalaConnection` | 10 | DI | 19/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | con escenario | P08 |
| `tImpalaCreateTable` | 10 | DI | 49/30 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tImpalaInput` | 10 | DI | 27/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | con escenario | P08 |
| `tImpalaLoad` | 10 | DI | 30/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tImpalaOutput` | 10 | DI | 26/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tImpalaRow` | 10 | DI | 28/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | sin medir | con escenario | P08 |
| `tSparkConfiguration` | 13 | SPARK | 318/200 | SUBJOB_OK COMPONENT_OK | 4 | ninguno | n/a | n/a | P10 |
| `tSparkConfiguration` | 13 | SPARKSTREAMING | 231/137 | SUBJOB_OK COMPONENT_OK | 4 | ninguno | n/a | n/a | P10 |
| `tSparkConfiguration` | 13 | STRUCTUREDSTREAMING | 102/40 | SUBJOB_OK COMPONENT_OK | 4 | ninguno | n/a | n/a | P10 |
