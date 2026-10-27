# Catalogo completo de componentes de Talend 8.0.1

> Generado por `bun run scripts/catalogo-componentes.ts` a partir de las definiciones instaladas en Studio, los informes
> `testdata/cobertura-*.csv` y los escenarios L5. **No se edita a mano**: se regenera. El plan para probarlos y
> documentarlos esta en [../plan-componentes/README.md](../plan-componentes/README.md).

Total: **1175** componentes (DI: 777 · SPARK: 166 · SPARKSTREAMING: 171 · STRUCTUREDSTREAMING: 60 · OTHER: 1).
Compilan en L4: **439**. Con escenario L5: **92**.

## Como leer las tablas

| Columna | Significado |
|---|---|
| Nivel | Prioridad 1 (primero) a 12 (ultimo). Ver la tabla de niveles |
| Paleta | `DI` = job Standard. El resto son Spark/Streaming: se prueban con otro plan |
| Params (oblig.) | Parametros totales / obligatorios segun el XML de definicion |
| Conectores | Tipos de enlace que admite (FLOW, ITERATE, REJECT, SUBJOB_OK...) |
| Libs oblig. | Jars que el componente exige y que Studio puede tener que descargar |
| Servicio externo | Que hay que levantar o emular para ejecutarlo de verdad (L5); el detalle esta en [EMULADORES.md](../plan-componentes/EMULADORES.md) |
| L4 (compila) | Resultado historico de montar el componente en un job minimo y compilar |
| L5 | `con escenario` = hay un escenario ejecutable; `pendiente` = definido pero no pasa aun. **Todo debe acabar ejecutado**: nada se queda en `solo compila` |
| Plan | Plan de trabajo con el detalle de como probarlo (carpeta `docs/plan-componentes/`) |

## Niveles de prioridad

| Nivel | Descripcion | Componentes | Compilan | Sin compilar | Con L5 | Sin L5 |
|---|---|---|---|---|---|---|
| 1 | Nucleo de cualquier job | 44 | 34 | 10 | 35 | 9 |
| 2 | Control, auditoria y ejecucion | 23 | 20 | 3 | 6 | 17 |
| 3 | Archivos | 50 | 37 | 13 | 18 | 32 |
| 4 | XML, JSON y mapeos complejos | 14 | 7 | 7 | 0 | 14 |
| 5 | Bases de datos relacionales | 287 | 239 | 48 | 11 | 276 |
| 6 | ELT y SQL | 44 | 0 | 44 | 0 | 44 |
| 7 | Transferencia de ficheros | 22 | 10 | 12 | 6 | 16 |
| 8 | Cloud y mensajeria | 60 | 14 | 46 | 0 | 60 |
| 9 | APIs y servicios | 15 | 1 | 14 | 1 | 14 |
| 10 | Big Data y NoSQL | 74 | 40 | 34 | 8 | 66 |
| 11 | Calidad y privacidad de datos | 63 | 15 | 48 | 7 | 56 |
| 12 | Resto de la paleta Standard (baja prioridad) | 81 | 22 | 59 | 0 | 81 |
| 13 | Paletas Spark, Streaming y MapReduce | 398 | 0 | 398 | 0 | 398 |

## Por plan de trabajo

| Plan | Alcance | Componentes | Sin compilar (L4) | Sin L5 |
|---|---|---|---|---|
| [P01](../plan-componentes/P01-nucleo-y-control.md) | Nucleo, control y auditoria | 85 | 23 | 44 |
| [P02](../plan-componentes/P02-archivos.md) | Archivos, XML y JSON | 64 | 20 | 46 |
| [P03](../plan-componentes/P03-bases-de-datos-relacionales.md) | Bases de datos relacionales | 287 | 48 | 276 |
| [P04](../plan-componentes/P04-elt-y-sql.md) | ELT y SQL | 44 | 44 | 44 |
| [P05](../plan-componentes/P05-transferencia-de-ficheros.md) | Transferencia de ficheros (FTP, SCP, SSH) | 22 | 12 | 16 |
| [P06](../plan-componentes/P06-cloud-y-mensajeria.md) | Cloud y mensajeria | 60 | 46 | 60 |
| [P07](../plan-componentes/P07-apis-y-servicios.md) | APIs, servicios y directorios | 15 | 14 | 14 |
| [P08](../plan-componentes/P08-big-data-y-nosql.md) | Big Data y NoSQL | 74 | 34 | 66 |
| [P09](../plan-componentes/P09-calidad-y-privacidad.md) | Calidad y privacidad de datos | 63 | 48 | 56 |
| [P10](../plan-componentes/P10-paletas-no-di.md) | Paletas Spark, MapReduce y Streaming | 398 | 398 | 398 |
| [P11](../plan-componentes/P11-negocio-y-legado.md) | Negocio (SAP, CRM), legado y resto | 63 | 49 | 63 |

## Por grupo de familias (un fichero cada uno)

| Grupo | Componentes | Compilan (L4) | Con L5 |
|---|---|---|---|
| [Databases](databases.md) | 393 | 250 | 15 |
| [File](file.md) | 111 | 49 | 20 |
| [Processing](processing.md) | 99 | 16 | 9 |
| [Data Quality](data-quality.md) | 86 | 8 | 4 |
| [Internet](internet.md) | 55 | 20 | 7 |
| [ELT](elt.md) | 49 | 0 | 0 |
| [Technical](technical.md) | 41 | 20 | 0 |
| [Big Data](big-data.md) | 41 | 0 | 3 |
| [Databases NoSQL](databases-nosql.md) | 35 | 24 | 0 |
| [Business](business.md) | 31 | 1 | 0 |
| [Messaging](messaging.md) | 30 | 0 | 0 |
| [Data Privacy](data-privacy.md) | 29 | 3 | 5 |
| [Misc](misc.md) | 20 | 9 | 3 |
| [Custom Code](custom-code.md) | 19 | 9 | 4 |
| [Machine Learning](machine-learning.md) | 17 | 0 | 0 |
| [Orchestration](orchestration.md) | 17 | 14 | 10 |
| [MapReduce](mapreduce.md) | 16 | 0 | 0 |
| [Storage](storage.md) | 14 | 0 | 0 |
| [Cloud](cloud.md) | 13 | 0 | 0 |
| [Logs Errors](logs-errors.md) | 11 | 11 | 8 |
| [Deprecated](deprecated.md) | 11 | 0 | 1 |
| [XML](xml.md) | 10 | 3 | 0 |
| [ElasticSearch](elasticsearch.md) | 6 | 0 | 0 |
| [System](system.md) | 4 | 2 | 3 |
| [Talend Cloud](talend-cloud.md) | 3 | 0 | 0 |
| [ML](ml.md) | 2 | 0 | 0 |
| [Business Intelligence](business-intelligence.md) | 2 | 0 | 0 |
| [Talend Data Preparation](talend-data-preparation.md) | 2 | 0 | 0 |
| [DotNET](dotnet.md) | 2 | 0 | 0 |
| [Webservice](webservice.md) | 2 | 0 | 0 |
| [Authentication](authentication.md) | 2 | 0 | 0 |
| [Test and check](test-and-check.md) | 1 | 0 | 0 |
| [Unstructured](unstructured.md) | 1 | 0 | 0 |

Otros ficheros: [fallos-conocidos-l4.md](fallos-conocidos-l4.md).
