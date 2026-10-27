# Catalogo: Cloud

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

13 componentes · 0 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: Cloud · Cloud/Amazon/EMR · Cloud/Dropbox · Cloud/Google/Dataproc · Cloud/GoogleCloudPlatform

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAmazonEMRListInstances` | 8 | DI | 21/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 32 | AWS: LocalStack/moto | sin medir | sin escenario | P06 |
| `tAmazonEMRManage` | 8 | DI | 56/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 32 | AWS: LocalStack/moto | sin medir | sin escenario | P06 |
| `tAmazonEMRResize` | 8 | DI | 25/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 32 | AWS: LocalStack/moto | sin medir | sin escenario | P06 |
| `tCloudStart` | 8 | DI | 15/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P06 |
| `tCloudStop` | 8 | DI | 7/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P06 |
| `tDropboxConnection` | 8 | DI | 4/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | SaaS: servidor falso + proxy | sin medir | sin escenario | P06 |
| `tDropboxDelete` | 8 | DI | 7/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | SaaS: servidor falso + proxy | sin medir | sin escenario | P06 |
| `tDropboxGet` | 8 | DI | 10/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | SaaS: servidor falso + proxy | sin medir | sin escenario | P06 |
| `tDropboxList` | 8 | DI | 9/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | SaaS: servidor falso + proxy | sin medir | sin escenario | P06 |
| `tDropboxPut` | 8 | DI | 16/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | SaaS: servidor falso + proxy | sin medir | sin escenario | P06 |
| `tGoogleCloudConfiguration` | 13 | SPARKSTREAMING | 8/2 | SUBJOB_OK COMPONENT_OK | - | ninguno | n/a | n/a | P10 |
| `tGoogleCloudConfiguration` | 13 | STRUCTUREDSTREAMING | 8/2 | SUBJOB_OK COMPONENT_OK | - | ninguno | n/a | n/a | P10 |
| `tGoogleDataprocManage` | 8 | DI | 25/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 53 | Google: emuladores | sin medir | sin escenario | P06 |
