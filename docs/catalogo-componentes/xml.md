# Catalogo: XML

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

10 componentes · 3 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: XML

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tDTDValidator` | 4 | DI | 6/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tEDIFACTtoXML` | 4 | DI | 5/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | falla | sin escenario | P02 |
| `tExtractXMLField` | 4 | DI | 15/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | falla | sin escenario | P02 |
| `tWriteJSONFieldIn` | 12 | DI | 9/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | ninguno | sin medir | sin escenario | P01 |
| `tWriteXMLField` | 4 | DI | 19/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P02 |
| `tWriteXMLFieldIn` | 12 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tWriteXMLFieldOut` | 12 | DI | 23/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | falla | sin escenario | P01 |
| `tXMLMap` | 4 | DI | 5/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | compila | sin escenario | P02 |
| `tXSDValidator` | 4 | DI | 11/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tXSLT` | 4 | DI | 12/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P02 |
