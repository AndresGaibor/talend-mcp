# P11 · Negocio, legado y resto

Nivel 10 del catalogo: 63 componentes Standard (paleta `DI`). Mezcla tres cosas que no comparten servicio:
conectores de negocio (SAP, Salesforce, Microsoft CRM, ServiceNow), componentes **deprecated** (Box, Jasper) y los
pares internos `*In`/`*Out` de la familia `Technical`, que no se miden solos.

- Catalogo: [business](../catalogo-componentes/business.md), [technical](../catalogo-componentes/technical.md),
  [deprecated](../catalogo-componentes/deprecated.md), [business-intelligence](../catalogo-componentes/business-intelligence.md),
  [elt](../catalogo-componentes/elt.md) (solo `tELTSAPInput` y `tELTSAPMap`).
- Ninguno tiene escenario L5 hoy. Empezar desde cero.

## 1. Grupos

| Grupo | Componentes | Servicio / sustituto |
|---|---|---|
| SAP (conexion, lectura, escritura, BAPI, IDoc, ODP, InfoObject, DSO, ADSO) | `tSAPConnection`, `tSAPCommit`, `tSAPRollback`, `tSAPBapi`, `tSAPTableInput`, `tSAPIDocInput`, `tSAPIDocOutput`, `tSAPIDocReceiver`, `tSAPDataSourceOutput`, `tSAPDataSourceReceiver`, `tSAPDSOInput`, `tSAPDSOOutput`, `tSAPADSOInput`, `tSAPADSOOutput`, `tSAPInfoCubeInput`, `tSAPInfoObjectInput`, `tSAPInfoObjectOutput`, `tSAPODPInput`, `tELTSAPInput`, `tELTSAPMap` | Peldano 6 de la escalera: doble del cliente SAP JCo. Sin servidor SAP real no hay validacion de protocolo |
| CRM y SaaS (Microsoft CRM, Salesforce Einstein, ServiceNow) | `tMicrosoftCrmInput`, `tMicrosoftCrmOutput`, `tSalesforceEinsteinBulkExec`, `tSalesforceEinsteinOutputBulkExec`, `tServiceNowConnection`, `tServiceNowInput`, `tServiceNowOutput` | Peldano 5: servidor HTTP falso con respuestas grabadas |
| Graficos de BI | `tBarChart`, `tLineChart` | Local. Generan imagen; la salida se comprueba con el fichero |
| Pares internos (`*In`/`*Out`, tablas hash, arrays, `tIterateToFlowOut`, `tDynamicGuessSchema`, `tJobStructureCatcher`, `tDummyRow`) | `tAggregateIn`, `tAggregateOut`, `tArray`, `tArrayIn`, `tDenormalizeOut`, `tHash`, `tHashInput`, `tHashOutput`, `tAdvancedHash`, `tAdvancedXMLMapHash`, `tMapIn`, `tMapOut`, `tSortIn`, `tSortOut`, `tUniqRowIn`, `tUniqRowOut`, `tXMLMapIn`, `tXMLMapOut`, `tSAPBapiIn`, `tSAPBapiOut`, `tSAPInfoObjectOutputIn`, `tSAPInfoObjectOutputOut`, `tIterateToFlowOut`, `tDynamicGuessSchema`, `tJobStructureCatcher`, `tDummyRow` | Local. No se miden solos: se cubren con su componente visible (ver [P02](P02-archivos.md) seccion 7) |
| Deprecated (Box, Jasper) | `tBoxConnection`, `tBoxCopy`, `tBoxDelete`, `tBoxGet`, `tBoxList`, `tBoxPut`, `tJasperOutput`, `tJasperOutputExec` | Box: servidor HTTP falso. Jasper: servidor de informes falso. Probablemente candidatos a retirar del alcance: decision de la persona responsable |

Los componentes deprecated no se borran del catalogo. Si la persona responsable decide retirarlos del alcance, quedan
en `EXCEPCIONES.md` con esa decision escrita; el agente no los retira por su cuenta.

## 2. Principio: los pares internos no cuentan aparte

`*In` y `*Out` son la mitad de un componente visible. Medirlos solos da fallos enganosos. Su estado es el de su
componente visible: si `tMap` tiene escenario, `tMapIn`/`tMapOut` quedan cubiertos por el mismo escenario.

## 3. Orden de trabajo

1. Pares internos: confirmar en el seguimiento qué componente visible los cubre. Sin trabajo propio.
2. Graficos de BI (`tBarChart`, `tLineChart`): local, rapido.
3. CRM y SaaS con servidor falso (Salesforce, ServiceNow, Microsoft CRM).
4. Box con servidor falso; decision sobre Jasper y los deprecated.
5. SAP con doble de JCo (peldano 6). Es lo mas caro y lo que mas depende del fabricante: va al final.

## 4. Trampas

| Trampa | Que hacer |
|---|---|
| SAP necesita el cliente JCo (`sapjco3`), que no se puede redistribuir | Doble de la libreria solo en `testdata/`, sin el producto real (EMULADORES.md peldano 6). Declarar en la ficha que no valida el protocolo SAP |
| Los `*In`/`*Out` fallan al compilar solos | Es lo esperado: se cubren con el visible |
| CRM y SaaS piden OAuth o credenciales reales | Servidor falso que acepta un token de laboratorio. Las claves reales nunca van al repositorio |
| Componentes deprecated | Probar que compilan y dar el aviso de deprecacion en la ficha; no invertir mas |

## 5. Aceptacion de P11

- Los 63 componentes en A (servicio real) o A-emu (sustituto), con ficha y escenario L5 ejecutado.
- Los pares internos citados en la ficha de su componente visible.
- Lo que no se pueda ejecutar queda en `EXCEPCIONES.md` con la razon y sin cerrar por el agente.
