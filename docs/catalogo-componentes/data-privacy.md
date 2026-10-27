# Catalogo: Data Privacy

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

29 componentes · 3 compilan (L4) · 5 con escenario L5 que pasa o esta definido.

Subfamilias: Data_Privacy

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tDataDecrypt` | 11 | DI | 9/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | compila | con escenario | P09 |
| `tDataDecrypt` | 13 | SPARK | 9/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | ninguno | n/a | n/a | P10 |
| `tDataDecrypt` | 13 | SPARKSTREAMING | 9/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | ninguno | n/a | n/a | P10 |
| `tDataDecrypt` | 13 | STRUCTUREDSTREAMING | 9/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tDataEncrypt` | 11 | DI | 9/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | compila | con escenario | P09 |
| `tDataEncrypt` | 13 | SPARK | 9/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | ninguno | n/a | n/a | P10 |
| `tDataEncrypt` | 13 | SPARKSTREAMING | 9/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 2 | ninguno | n/a | n/a | P10 |
| `tDataEncrypt` | 13 | STRUCTUREDSTREAMING | 10/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tDataMasking` | 11 | DI | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 13 | ninguno | compila | con escenario | P09 |
| `tDataMasking` | 13 | SPARK | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tDataMasking` | 13 | SPARKSTREAMING | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tDataMasking` | 13 | STRUCTUREDSTREAMING | 16/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tDataShuffling` | 11 | DI | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | con escenario | P09 |
| `tDataShuffling` | 13 | SPARK | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tDataShufflingIn` | 11 | DI | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P09 |
| `tDataShufflingOut` | 11 | DI | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P09 |
| `tDataUnmasking` | 11 | DI | 12/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 13 | ninguno | falla | sin escenario | P09 |
| `tDataUnmasking` | 13 | SPARK | 12/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tDataUnmasking` | 13 | SPARKSTREAMING | 12/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | n/a | n/a | P10 |
| `tDataUnmasking` | 13 | STRUCTUREDSTREAMING | 15/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tDuplicateRow` | 1 | DI | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | falla | con escenario | P01 |
| `tPatternMasking` | 11 | DI | 16/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 11 | ninguno | falla | sin escenario | P09 |
| `tPatternMasking` | 13 | SPARK | 16/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | n/a | n/a | P10 |
| `tPatternMasking` | 13 | SPARKSTREAMING | 16/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | n/a | n/a | P10 |
| `tPatternMasking` | 13 | STRUCTUREDSTREAMING | 16/4 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tPatternUnmasking` | 11 | DI | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 10 | ninguno | falla | sin escenario | P09 |
| `tPatternUnmasking` | 13 | SPARK | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | ninguno | n/a | n/a | P10 |
| `tPatternUnmasking` | 13 | SPARKSTREAMING | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | ninguno | n/a | n/a | P10 |
| `tPatternUnmasking` | 13 | STRUCTUREDSTREAMING | 15/4 | FLOW | - | ninguno | n/a | n/a | P10 |
