# Catalogo: Orchestration

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

17 componentes · 14 compilan (L4) · 10 con escenario L5 que pasa o esta definido.

Subfamilias: Orchestration

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAsyncIn` | 12 | DI | 6/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF PARALLELIZE SYNCHRONIZE | - | ninguno | falla | sin escenario | P01 |
| `tAsyncOut` | 12 | DI | 5/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF PARALLELIZE SYNCHRONIZE | - | ninguno | compila | sin escenario | P01 |
| `tFlowToIterate` | 1 | DI | 2/1 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tForeach` | 1 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tInfiniteLoop` | 2 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tIterateToFlow` | 1 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tLoop` | 1 | DI | 9/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tLoop` | 13 | SPARK | 9/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tParallelize` | 1 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF PARALLELIZE SYNCHRONIZE | - | ninguno | compila | con escenario | P01 |
| `tPostjob` | 1 | DI | 0/0 | COMPONENT_OK | - | ninguno | compila | con escenario | P01 |
| `tPrejob` | 1 | DI | 0/0 | COMPONENT_OK | - | ninguno | compila | con escenario | P01 |
| `tReplicate` | 1 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tSleep` | 1 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tUnite` | 1 | DI | 1/1 | FLOW MERGE ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tWaitForFile` | 3 | DI | 13/4 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tWaitForSocket` | 2 | DI | 5/3 | SUBJOB_OK SUBJOB_ERROR ITERATE COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tWaitForSqlData` | 2 | DI | 12/6 | SUBJOB_OK SUBJOB_ERROR ITERATE COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
