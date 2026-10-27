# Catalogo: Processing

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

99 componentes · 16 compilan (L4) · 9 con escenario L5 que pasa o esta definido.

Subfamilias: Processing · Processing/Fields

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAggregateRow` | 1 | DI | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tAggregateRow` | 13 | SPARK | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAggregateRow` | 13 | SPARKSTREAMING | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAggregateRow` | 13 | STRUCTUREDSTREAMING | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAggregateSortedRow` | 12 | DI | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tAvroMap` | 13 | SPARK | 5/1 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAvroMap` | 13 | SPARKSTREAMING | 5/1 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tCacheClear` | 13 | SPARK | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tCacheIn` | 13 | SPARK | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tCacheIn` | 13 | SPARKSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tCacheOut` | 13 | SPARK | 6/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tCacheOut` | 13 | SPARKSTREAMING | 6/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tConvertType` | 1 | DI | 6/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tConvertType` | 13 | SPARK | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tConvertType` | 13 | SPARKSTREAMING | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tDenormalize` | 1 | DI | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | con escenario | P01 |
| `tDenormalize` | 13 | SPARK | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tDenormalize` | 13 | SPARKSTREAMING | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tDenormalizeSortedRow` | 12 | DI | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tExternalSortRow` | 12 | DI | 10/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tExtractAbstractAvroFields` | 13 | SPARK | 7/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tExtractAbstractAvroFields` | 13 | SPARKSTREAMING | 8/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tExtractAbstractJSONFields` | 13 | SPARK | 15/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tExtractAbstractJSONFields` | 13 | SPARKSTREAMING | 15/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tExtractDelimitedFields` | 1 | DI | 13/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tExtractDelimitedFields` | 13 | SPARK | 19/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractDelimitedFields` | 13 | SPARKSTREAMING | 19/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractDynamicFields` | 12 | DI | 1/1 | FLOW | - | ninguno | compila | sin escenario | P01 |
| `tExtractFullRow` | 13 | SPARK | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractFullRow` | 13 | SPARKSTREAMING | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractJSONFields` | 4 | DI | 15/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tExtractJSONFields` | 13 | SPARK | 13/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tExtractJSONFields` | 13 | SPARKSTREAMING | 13/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tExtractPositionalFields` | 4 | DI | 13/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tExtractPositionalFields` | 13 | SPARK | 12/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractPositionalFields` | 13 | SPARKSTREAMING | 12/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractRegexFields` | 1 | DI | 7/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tExtractRegexFields` | 13 | SPARK | 6/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractRegexFields` | 13 | SPARKSTREAMING | 6/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tExtractXMLField` | 13 | SPARK | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | n/a | n/a | P10 |
| `tExtractXMLField` | 13 | SPARKSTREAMING | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | n/a | n/a | P10 |
| `tFilterColumns` | 1 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tFilterColumns` | 13 | SPARK | 1/1 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFilterColumns` | 13 | SPARKSTREAMING | 1/1 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFilterColumns` | 13 | STRUCTUREDSTREAMING | 1/1 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFilterRow` | 1 | DI | 7/3 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tFilterRow` | 13 | SPARK | 7/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFilterRow` | 13 | SPARKSTREAMING | 7/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFilterRow` | 13 | STRUCTUREDSTREAMING | 8/3 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tJoin` | 1 | DI | 6/4 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tManagePartitions` | 13 | SPARK | 13/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tMap` | 1 | DI | 11/1 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tMap` | 13 | SPARK | 8/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tMap` | 13 | SPARKSTREAMING | 7/1 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMap` | 13 | STRUCTUREDSTREAMING | 7/1 | FLOW LOOKUP ITERATE COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | n/a | n/a | P10 |
| `tNormalize` | 1 | DI | 9/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | con escenario | P01 |
| `tNormalize` | 13 | SPARK | 8/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tNormalize` | 13 | SPARKSTREAMING | 8/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tPartition` | 13 | SPARK | 14/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tReplace` | 1 | DI | 7/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P01 |
| `tReplace` | 13 | SPARK | 7/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tReplace` | 13 | SPARKSTREAMING | 7/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tReplicate` | 13 | SPARK | 8/5 | FLOW SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tReplicate` | 13 | SPARKSTREAMING | 8/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tReplicate` | 13 | STRUCTUREDSTREAMING | 3/2 | FLOW SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tSample` | 13 | SPARK | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tSampleRow` | 1 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSortRow` | 1 | DI | 6/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tSortRow` | 13 | SPARK | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSortRow` | 13 | SPARKSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSortRow` | 13 | STRUCTUREDSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSplitRow` | 1 | DI | 2/1 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSqlRow` | 13 | SPARK | 9/4 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSqlRow` | 13 | SPARKSTREAMING | 9/4 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSurviveFields` | 11 | DI | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P09 |
| `tTop` | 13 | SPARK | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tTop` | 13 | SPARKSTREAMING | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tTopBy` | 13 | SPARK | 4/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tTopBy` | 13 | SPARKSTREAMING | 4/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tTopBy` | 13 | STRUCTUREDSTREAMING | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tUniqRow` | 13 | SPARK | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tUniqRow` | 13 | SPARKSTREAMING | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tUnite` | 13 | SPARK | 1/1 | FLOW MERGE | - | ninguno | n/a | n/a | P10 |
| `tUnite` | 13 | SPARKSTREAMING | 1/1 | FLOW MERGE | - | ninguno | n/a | n/a | P10 |
| `tWindow` | 13 | SPARKSTREAMING | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tWindow` | 13 | STRUCTUREDSTREAMING | 8/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tWriteAvroFields` | 13 | SPARKSTREAMING | 2/1 | FLOW | 3 | ninguno | n/a | n/a | P10 |
| `tWriteAvroFields` | 13 | STRUCTUREDSTREAMING | 3/1 | FLOW | 3 | ninguno | n/a | n/a | P10 |
| `tWriteDelimitedFields` | 13 | SPARKSTREAMING | 14/8 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWriteDelimitedFields` | 13 | STRUCTUREDSTREAMING | 16/8 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWriteDynamicFields` | 12 | DI | 1/1 | FLOW | - | ninguno | falla | sin escenario | P01 |
| `tWriteJSONField` | 4 | DI | 14/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P02 |
| `tWriteJSONField` | 13 | SPARK | 10/4 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tWriteJSONField` | 13 | SPARKSTREAMING | 9/3 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tWriteJSONFields` | 13 | STRUCTUREDSTREAMING | 13/4 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWritePositionalFields` | 13 | SPARKSTREAMING | 12/10 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWritePositionalFields` | 13 | STRUCTUREDSTREAMING | 14/10 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWriteXMLFields` | 13 | SPARKSTREAMING | 11/7 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tWriteXMLFields` | 13 | STRUCTUREDSTREAMING | 13/5 | FLOW | 2 | ninguno | n/a | n/a | P10 |
