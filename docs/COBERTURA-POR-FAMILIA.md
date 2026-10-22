# Cobertura por familia y orden de las proximas tandas

Foto del catalogo de componentes de Talend 8.0.1 a 22/10/2026, sacada de los informes
`testdata/cobertura-l4-*.csv` y del catalogo instalado. Sirve para decidir que familia se mide
siguiente y que familia no se toca todavia.

La fuente de verdad siguen siendo los CSV y el estado de las fases en
[PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md). Este documento es la lectura por familia de esos datos.

## 1. Como se lee

```bash
bun run scripts/cobertura-familias.ts --todas      # mapa completo por familia
bun run scripts/cobertura-familias.ts --familia DB # una familia o un prefijo
bun run scripts/cobertura-familias.ts --pendientes # lista para coverage.ts --components
```

Un componente cuenta como medido si en **alguna** corrida salio `compila=si`; si solo aparece en
los informes viejos de L1/L2 (sin columna `compila`), no cuenta como medido a L4.

| Nivel | Que comprueba | Como se mide |
|---|---|---|
| L1-L2 | el nodo se crea, acepta parametros y se guarda en el `.item` | `scripts/coverage.ts` sin `--compile` |
| L3-L4 | se monta en un job minimo, se conecta y compila | `scripts/coverage.ts --compile` |
| L5 | ejecuta y la salida coincide con la esperada | `scripts/execution-check.ts` |

**L4 no quiere decir que el componente funcione**: dice que Talend genera codigo y compila. Para
que ademas ejecute hacen falta la configuracion real y, en las bases de datos, el driver y el
servidor.

## 2. Resumen

| Medicion | Resultado |
|---|---|
| Componentes instalados en el catalogo | 913 en 139 familias |
| Componentes intentados a L4 | 474 |
| Compilan | 407 (86 % de los intentados, 45 % del catalogo) |
| Fallan | 67 (ver seccion 5: 19 no son del componente) |
| Sin medir | 439 |
| Componentes con L5 verificado | 29, en 28 escenarios |

El catalogo de 913 incluye todo lo que declara XML en los plugins instalados. La medicion L1/L2
de los 897 Standard (98 %) esta en `testdata/cobertura.csv` y no entra en este recuento.

## 3. Familias del nucleo DI

Son las que usa un ETL normal. La mayoria ya esta medida; los huecos son pocos y concretos.

| Familia | Total | Compilan | Fallan | Sin medir | Estado |
|---|---:|---:|---:|---:|---|
| File/Output | 18 | 16 | 2 | 0 | cerrada; fallan `tAdvancedFileOutputXML` y `tFileOutputARFF` (Weka) |
| Logs_Errors | 11 | 11 | 0 | 0 | cerrada |
| Custom_Code | 9 | 9 | 0 | 0 | cerrada |
| Misc | 12 | 11 | 1 | 0 | cerrada; falla `tContextLoad` |
| Orchestration | 16 | 14 | 2 | 0 | cerrada; fallan `tAsyncIn` y `tForeach` |
| Processing | 24 | 22 | 2 | 0 | cerrada; fallan `tAggregateSortedRow` y `tAvroMap` |
| Processing/Fields | 19 | 13 | 6 | 0 | a medias; `tDenormalize`, `tExtractDelimitedFields`, `tWriteJSONField` |
| File/Input | 27 | 23 | 3 | 1 | a medias; `tFileInputExcel`, `tFileInputXML`, `tFileInputMSXML`, `tAvroInput` |
| File/Management | 13 | 9 | 3 | 1 | a medias; `tFileUnarchive`; dos fallos son del arnes |
| XML | 10 | 3 | 6 | 1 | a medias; `tXSLT`, `tWriteXMLField`, `tExtractXMLField`, `tWriteJSONFieldIn` |
| Data_Quality | 18 | 2 | 14 | 2 | a medias; 9 de los 14 fallos son del arnes |
| Technical | 38 | 22 | 16 | 0 | no vale la pena: casi todos son mitades de un par |
| Databases/DB Specifics | 290 | 247 | 2 | 41 | las 25 familias base estan medidas; quedan 41 sueltos |

Las familias base de `Databases/DB Specifics` se midieron en tandas (las 25 que cubren desde
PostgreSQL y MySQL hasta DB2, Informix, Teradata o Vertica) y **compilan sin instalar el driver**:
el codigo generado carga el driver por nombre al ejecutar. Los dos fallos conocidos son
`tCosmosDBClose` (falta el driver de MongoDB) y `tIngresBulkExec` (codigo generado roto).

Los 41 componentes que quedan sin medir en esa familia, por subfamilia: Redshift 9, EXASolution 5,
Access 4, SAP Hana 4, VectorWise 4, HSQLDb 3, JavaDb 3, MaxDB 3, Synapse 2, Cosmos DB 1,
Amazon Oracle 1, FireBird 1, SQLite 1.

## 4. Familias pendientes por costo

### 4.1 Se pueden medir sin servicios externos

| Familia | Componentes | Valor |
|---|---:|---|
| Data_Privacy | 10 | enmascarar, cifrar, ofuscar y `tDuplicateRow`: uso bancario directo |
| System | 4 | `tSystem` y `tSetEnv` son locales; `tSSH` necesita un host |
| Data_Quality/Standardization | 6 | telefono, nombres y transliteracion |
| File/NamedPipe | 3 | local y barato, aunque de bajo uso |

### 4.2 Necesitan un servicio local (Docker o similar)

| Familia | Componentes | Servicio |
|---|---:|---|
| Internet/FTP | 10 | servidor FTP |
| Internet/SCP | 9 | servidor SSH |
| Internet/MOM and JMS | 10 | broker JMS |
| Internet | 14 | socket, correo, SOAP, RSS y SVN |
| Databases NoSQL/MongoDB | 12 | MongoDB |
| Business/LDAP | 6 | OpenLDAP |
| Databases NoSQL/Cassandra | 4 | Cassandra |
| Messaging/Kafka e Internet/Kafka | 9 | Kafka |
| ElasticSearch | 4 | Elasticsearch |

### 4.3 Fuera de alcance por ahora

| Grupo | Componentes | Motivo |
|---|---:|---|
| Big Data y MapReduce | 49 | este workspace no abre jobs Spark; ademas hace falta cluster |
| File/Hadoop y Storage (HDFS, S3, Azure, GCS) | 20 | cluster y credenciales |
| Cloud y Talend Cloud | 15 | credenciales de AWS, GCP, Azure y TMC |
| ELT (Map y SQLTemplate) | 49 | exige bases vivas y es otro paradigma de ejecucion |
| Machine Learning y ML | 17 | Weka viejo y sin uso en el cliente |
| Business/SAP, Salesforce, ServiceNow, Microsoft CRM | 25 | `sapjco3` no es accesible; el resto pide cuenta |
| Data_Quality/Address y proveedores | 14 | MelissaData, Loqate y Experian QAS son APIs de pago |
| Deprecated, MapR, DynamoDB antiguo, DotNET, EDIFACT, BI Charts, Talend Data Prep | 33 | sin valor para el objetivo |
| Athena, Databricks SQL, Delta y Single Store | 20 | falta `components-jdbc-runtime` en el `.m2` |

## 5. Fallos que no son del componente

De los 67 fallos, **19 son del arnes**: el agregador Maven de Studio se rompio con
`Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor`
(INTERNALS 51) y el componente quedo marcado sin haberlo probado de verdad. Son:

`tAddCRCRow`, `tDqReportRun`, `tFindRegexlibExpressions`, `tJapaneseNumberNormalize`,
`tJapaneseTokenize`, `tJapaneseTransliterate`, `tReservoirSamplingIn`, `tSchemaComplianceCheck`,
`tVerifyEmail`, `tFileArchive`, `tFileRowCount`, `tEDIFACTtoXML`, `tExtractXMLField`, y los seis de
SAP (`tSAPADSOOutput`, `tSAPBapi`, `tSAPDSOOutput`, `tSAPIDocInput`, `tSAPIDocReceiver`,
`tSAPInfoCubeInput`).

Los seis de SAP no conviene reintentarlos sin `sapjco3`; los otros trece hay que repetirlos antes
de darlos por rotos.

Ademas hay fallos **obsoletos**: el CSV conserva un `no` de una corrida vieja aunque el componente
ya funcione. Dos casos conocidos: `tNormalize` (valida a L5) y `tRunJob` (compila y ejecuta en el
escenario de orquestacion). Antes de abrir un bug, repetir la medicion de ese componente solo.

Los fallos que si parecen reales y afectan al uso normal son:

| Componente | Error | Que falta |
|---|---|---|
| `tFileInputExcel` | `Syntax error on token ","` | revisar el generador del componente |
| `tFileInputXML` | `NameSpaceTool... cannot be resolved` | configurar espacios de nombres |
| `tFileInputMSXML` | falta cerrar una llave | revision del generador |
| `tDenormalize` | `ciudad cannot be resolved or is not a field` | columnas del esquema |
| `tExtractDelimitedFields` | `outConn` es null | conexion de salida |
| `tWriteJSONField` | `treeObjs` es null | arbol JSON de entrada |
| `tWriteXMLField` | `treeObjs` es null | arbol XML de entrada |
| `tXSLT` | `IllegalArgumentException` | hoja XSLT |
| `tContextLoad` | variable local duplicada | revision del generador |
| `tAggregateSortedRow` | error de sintaxis | revision del generador |

Los 16 de `Technical` (`tAggregateIn`, `tSortIn`, `tArrayIn`, `tSurviveIn`, `tUniqRowOut`...) son la
mitad de un par y no generan codigo por diseno del IDE: no se miden sueltos.

## 6. Tandas recomendadas

### Tanda 1: cerrar el nucleo

Objetivo: dejar el nucleo DI completo salvo `Technical`. No necesita servicios externos.

1. Repetir los 13 fallos del arnes que no son SAP.
2. Arreglar o documentar: `tFileInputExcel`, `tFileInputXML`, `tFileInputMSXML`, `tDenormalize`,
   `tExtractDelimitedFields`, `tWriteJSONField`, `tWriteXMLField`, `tXSLT`, `tContextLoad`,
   `tFileUnarchive`, `tAvroInput`.

Comando, con la lista en un fichero `testdata/pendientes-tanda1.txt`:

```powershell
bun run scripts/coverage.ts --components (Get-Content testdata/pendientes-tanda1.txt) --compile --out testdata/cobertura-l4-tanda1.csv
```

Al terminar, volver a correr `bun run scripts/cobertura-familias.ts --todas` y actualizar la
seccion 3.

### Tanda 2: Data_Privacy

Los 10 componentes, en una sola corrida. No necesitan nada externo y son los de mas valor
pendiente para un banco.

### Tanda 3: System y el L5 que falta

- L4 de `tSystem`, `tSetEnv` y `tSSH`.
- L5 de `tJoin`, `tLogCatcher`, `tJava`, `tJavaFlex` y del
  `tContextLoad` con sus variables (hoy solo se comprueba en el modelo).

### Tanda 4: conectividad con Docker

FTP, SCP, JMS, LDAP, Kafka, MongoDB, Cassandra y Elasticsearch. Son 74 componentes y cada familia
necesita su servicio. Se miden por familia, no todas de una vez.

### Tanda 5: drivers y subfamilias de base de datos

Solo si el cliente usa Redshift, SAP Hana, Access, EXASolution o las demas subfamilias sueltas.
Para L4 no hace falta el driver; para L5 si, y hay que instalarlo en el `.m2` de Studio.

## 7. Criterios de aceptacion

- **L4**: el componente se crea, se configura, se monta, compila y se borra; `compila=si` y el job
  no deja problemas de diseno.
- **L5**: hay un escenario en `tests/fixtures/talend/escenarios-l5.json` con la salida declarada
  **antes** de ejecutar, y `scripts/execution-check.ts` lo deja en verde.
- Un fallo se documenta con su causa y su plan de accion. Si es del arnes, se repite antes de
  abrir un bug.
- Cada trampa nueva de Studio va a [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md).

## 8. Como actualizar este documento

1. Medir la tanda con `scripts/coverage.ts`.
2. Correr `bun run scripts/cobertura-familias.ts --todas`.
3. Actualizar las tablas 3 y 4 con los totales nuevos.
4. Si un fallo paso a verde, quitarlo de la seccion 5; si aparecio uno nuevo, anotar el error.

Entre tandas largas hay que reiniciar Studio: el heap se llena con el codigo generado y, por encima
del 80 %, el agregador Maven empieza a fallar y contamina el informe (INTERNALS 39 y 51).
