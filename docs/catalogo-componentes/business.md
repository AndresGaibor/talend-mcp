# Catalogo: Business

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

31 componentes · 1 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: Business/LDAP · Business/Microsoft_CRM · Business/SAP · Business/Salesforce · Business/ServiceNow

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tLDAPAttributesInput` | 9 | DI | 26/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | LDAP: contenedor | sin medir | sin escenario | P07 |
| `tLDAPClose` | 9 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | LDAP: contenedor | compila | sin escenario | P07 |
| `tLDAPConnection` | 9 | DI | 14/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | LDAP: contenedor | sin medir | sin escenario | P07 |
| `tLDAPInput` | 9 | DI | 28/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | LDAP: contenedor | sin medir | sin escenario | P07 |
| `tLDAPOutput` | 9 | DI | 28/13 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | LDAP: contenedor | sin medir | sin escenario | P07 |
| `tLDAPRenameEntry` | 9 | DI | 21/7 | FLOW SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | LDAP: contenedor | sin medir | sin escenario | P07 |
| `tMicrosoftCrmInput` | 12 | DI | 36/26 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tMicrosoftCrmOutput` | 12 | DI | 36/27 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSalesforceEinsteinBulkExec` | 12 | DI | 27/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSalesforceEinsteinOutputBulkExec` | 12 | DI | 53/35 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPADSOInput` | 12 | DI | 45/30 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPADSOOutput` | 12 | DI | 20/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPBapi` | 12 | DI | 22/14 | FLOW MERGE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPCommit` | 12 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPConnection` | 12 | DI | 17/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPDataSourceOutput` | 12 | DI | 24/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPDataSourceReceiver` | 12 | DI | 20/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPDSOInput` | 12 | DI | 33/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPDSOOutput` | 12 | DI | 20/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPIDocInput` | 12 | DI | 18/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPIDocOutput` | 12 | DI | 15/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPIDocReceiver` | 12 | DI | 22/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPInfoCubeInput` | 12 | DI | 33/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | falla | sin escenario | P11 |
| `tSAPInfoObjectInput` | 12 | DI | 20/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPInfoObjectOutput` | 12 | DI | 24/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPODPInput` | 12 | DI | 37/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPRollback` | 12 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tSAPTableInput` | 12 | DI | 57/32 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tServiceNowConnection` | 12 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tServiceNowInput` | 12 | DI | 14/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
| `tServiceNowOutput` | 12 | DI | 12/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | negocio: servidor falso/doble | sin medir | sin escenario | P11 |
