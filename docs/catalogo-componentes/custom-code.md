# Catalogo: Custom Code

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

19 componentes · 9 compilan (L4) · 4 con escenario L5 que pasa o esta definido.

Subfamilias: Custom_Code

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tGroovy` | 12 | DI | 2/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P01 |
| `tGroovyFile` | 12 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P01 |
| `tHadoopConfManager` | 12 | DI | 4/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P01 |
| `tHadoopConfManager` | 13 | SPARK | 1/1 | FLOW | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tHadoopConfManager` | 13 | SPARKSTREAMING | 1/1 | FLOW | - | Hadoop: compose/local | n/a | n/a | P10 |
| `tJava` | 1 | DI | 2/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tJava` | 13 | SPARK | 4/1 | FLOW SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tJava` | 13 | SPARKSTREAMING | 4/1 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tJava` | 13 | STRUCTUREDSTREAMING | 4/1 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tJavaFlex` | 1 | DI | 9/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tJavaRow` | 1 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tJavaRow` | 13 | SPARK | 6/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tJavaRow` | 13 | SPARKSTREAMING | 6/2 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tLibraryLoad` | 2 | DI | 3/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tLibraryLoad` | 13 | SPARK | 2/1 | FLOW ITERATE | - | ninguno | n/a | n/a | P10 |
| `tLibraryLoad` | 13 | SPARKSTREAMING | 2/1 | FLOW ITERATE | - | ninguno | n/a | n/a | P10 |
| `tLibraryLoad` | 13 | STRUCTUREDSTREAMING | 2/1 | FLOW ITERATE | - | ninguno | n/a | n/a | P10 |
| `tSetDynamicSchema` | 12 | DI | 6/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSetGlobalVar` | 1 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
