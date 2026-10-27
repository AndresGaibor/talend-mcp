# Catalogo: Technical

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

41 componentes · 20 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: Technical

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAdvancedHash` | 12 | DI | 5/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | ninguno | falla | sin escenario | P11 |
| `tAdvancedXMLMapHash` | 12 | DI | 5/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | falla | sin escenario | P11 |
| `tAggregateIn` | 12 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tAggregateOut` | 12 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tArray` | 12 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tArrayIn` | 12 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tBoundedStreamInput` | 13 | SPARKSTREAMING | 11/10 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tCollectAndCheck` | 13 | SPARK | 12/4 | FLOW SUBJOB_OK | 1 | ninguno | n/a | n/a | P10 |
| `tCollectAndCheck` | 13 | SPARKSTREAMING | 13/4 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tCollectAndCheck` | 13 | STRUCTUREDSTREAMING | 13/4 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tDenormalizeOut` | 12 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tDummyRow` | 12 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tDynamicGuessSchema` | 12 | DI | 0/0 | FLOW | 3 | ninguno | falla | sin escenario | P11 |
| `tFileOutputShadow` | 3 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tHash` | 12 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tHashInput` | 12 | DI | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | pendiente | P11 |
| `tHashOutput` | 12 | DI | 9/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | pendiente | P11 |
| `tIterateToFlowOut` | 12 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tJobStructureCatcher` | 12 | DI | 3/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | ninguno | falla | sin escenario | P11 |
| `tMapIn` | 12 | DI | 0/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tMapOut` | 12 | DI | 0/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tMomInputIn` | 8 | DI | 24/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | falla | sin escenario | P06 |
| `tMomInputLoop` | 8 | DI | 42/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tRecordMatchingIn` | 11 | DI | 8/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | falla | sin escenario | P09 |
| `tRecordMatchingOut` | 11 | DI | 5/0 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | compila | sin escenario | P09 |
| `tSAPBapiIn` | 12 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P11 |
| `tSAPBapiOut` | 12 | DI | 20/13 | FLOW MERGE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPInfoObjectOutputIn` | 12 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | compila | sin escenario | P11 |
| `tSAPInfoObjectOutputOut` | 12 | DI | 22/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | compila | sin escenario | P11 |
| `tSortIn` | 12 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tSortOut` | 12 | DI | 7/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P11 |
| `tSurviveIn` | 11 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P09 |
| `tSurviveOut` | 11 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P09 |
| `tTaCoKitGuessSchema` | 13 | OTHER | 0/0 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tTeradataTPTOutput` | 5 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | BD: contenedor, H2 o driver shim | compila | sin escenario | P03 |
| `tThresholdViolationAlertIn` | 11 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P09 |
| `tThresholdViolationAlertOut` | 11 | DI | 9/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P09 |
| `tUniqRowIn` | 12 | DI | 5/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tUniqRowOut` | 12 | DI | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P11 |
| `tXMLMapIn` | 12 | DI | 0/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
| `tXMLMapOut` | 12 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P11 |
