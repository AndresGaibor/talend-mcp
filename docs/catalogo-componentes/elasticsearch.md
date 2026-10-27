# Catalogo: ElasticSearch

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

6 componentes · 0 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: ElasticSearch

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tElasticSearchConfiguration` | 13 | SPARK | 12/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tElasticSearchConfiguration` | 13 | SPARKSTREAMING | 19/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tElasticSearchInput` | 13 | SPARK | 16/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tElasticSearchLookupInput` | 13 | SPARKSTREAMING | 26/3 | FLOW | 1 | NoSQL: contenedor | n/a | n/a | P10 |
| `tElasticSearchOutput` | 13 | SPARK | 17/3 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
| `tElasticSearchOutput` | 13 | SPARKSTREAMING | 16/3 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | NoSQL: contenedor | n/a | n/a | P10 |
