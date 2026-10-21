# Hoja de ruta: automatizar Talend Studio al 100%

Objetivo: que un agente pueda crear, modificar, validar, ejecutar y publicar **cualquier** job de
Talend, con **cualquier** componente, hasta lo mas complejo, sin tocar la interfaz.

Estado de partida y guia de uso: [GUIA-AGENTE.md](GUIA-AGENTE.md). Pruebas por fase:
[PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md).

## 0. Definicion de "dominar" (para poder medirlo)

"Dominio al 100%" no se afirma: se mide con una matriz **componente x nivel**, generada por
`scripts/coverage.ts` y guardada en `testdata/cobertura.csv`.

| Nivel | Significa | Como se comprueba |
|---|---|---|
| L1 Crear | El nodo se arrastra de la paleta y existe en el job | `nodes/list` lo devuelve con su `uniqueName` real |
| L2 Configurar | Acepta parametros, tablas y schema, y el `.item` los conserva | Releer el nodo y comparar |
| L3 Conectar | Admite todas sus conexiones y triggers validos | `connect` ok y el `.item` tiene la conexion |
| L4 Compilar | Studio genera codigo y compila sin errores ni avisos | Problemas del job vacios |
| L5 Ejecutar | El job corre y la salida coincide con la esperada | `talend_job_execute` contra un resultado definido antes |

Hoy: **L1/L2 medido en los 897 componentes Standard: 877 (98 %)**. L3 y L4 se miden con
`scripts/coverage.ts`, que monta cada componente en un job minimo (origen y destino) y le rellena los
parametros obligatorios que declara el XML de la instalacion. En las nueve familias mas usadas (134
componentes) **134 se crean, guardan y borran, y 99 compilan (74 %)**: los que no compilan son, sobre todo, las
mitades de un par (`tAggregateIn`, `tSortIn`...) que necesitan su pareja, y los que necesitan una configuracion
real (tablas de transformacion, contexto). L5 (ejecutar con la salida correcta) esta validado con un arnes de
escenarios: tres en verde (humo, leer un CSV, leer y escribir un CSV).

### Las definiciones de los componentes, sin abrir Studio

Lo que un componente exige esta en su XML (`<nombre>_java.xml`), en la instalacion de Studio. El indice de esas
definiciones es lo que permite configurar cualquier componente sin adivinar:

- `talend_components_definition` (tool) y `scripts/component-definitions.ts` (script) dicen que parametros son
  obligatorios, con que valor se rellenan, que conexiones admite y que artefactos necesita.
- El plan de montaje (`planMount`) se le pasa al bridge: con el, la cobertura mide L3 y L4 de verdad.
- Las tablas de los parametros (`FORMATS`, `CONDITIONS`, `CRITERIA`) se rellenan con las columnas del schema:
  con eso, `tFilterRow`, `tSortRow` y `tAggregateRow` ya compilan.

Lo que no llega: los 120 componentes de la generacion nueva (los de los `.car`: AWS, JDBC, Snowflake...) no
tienen XML, su definicion esta en el codigo Java. Para ellos hay que preguntar a Studio.

## 1. Lo que bloqueaba la medicion (resuelto)

La cobertura reportaba los 1294 componentes como fallidos. Causas reales, reproducidas en vivo:

1. **Alta silenciosamente descartada.** Todo nodo se creaba en la posicion por defecto (128,128).
   Si ya habia uno ahi, GEF ignora el comando sin error y el nodo no entraba al job, pero `add`
   respondia `ok` con un nombre inventado. Con posiciones distintas todo entraba.
   **Arreglo:** colocacion automatica en el primer hueco libre de la rejilla, y `add` falla con
   un error claro si el nodo no queda en el proceso.
2. **Editores de jobs borrados.** Borrar un job no cierra su editor; al recrear el nombre, las
   operaciones podian caer en el editor obsoleto. **Arreglo:** `delete` cierra siempre los
   editores del job, y la busqueda de editor usa el titulo exacto (antes `contains`: `MCP_Fase1`
   casaba con `MCP_Fase10`).
3. **La prueba renombraba los nodos.** Configuraba los dos primeros parametros de texto, que son
   `UNIQUE_NAME` y `COMPONENT_NAME`. **Arreglo:** se saltan los parametros internos y se falla si
   configurar cambia el nombre del nodo.

(Se sospecho primero que `uniqueName` era poco fiable: no lo es, devuelve el nombre real.)

## 2. P0: cimientos (sin esto nada es fiable)

| # | Tarea | Hecho cuando |
|---|---|---|
| 1 | **Identidad del job**: ~~cerrar el editor al borrar, titulo exacto~~ (hecho). Pendiente: resolver por id del job y avisar si hay editores duplicados | `create(replace)` + `list` nunca devuelve nodos viejos |
| 2 | ~~`uniqueName` real~~ (ya lo era) + **alta verificada**: `add` falla si el nodo no entra (hecho) | El nombre devuelto siempre existe en el job |
| 3 | ~~Arreglar la prueba de cobertura~~ (hecho) | El CSV deja de ser 100 % fallos |
| 4 | ~~Leer los problemas del job~~ (hecho: `talend_job_problems`, avisos de diseno). Tambien hecho: **compilacion** sin ejecutar (`talend_job_compile`, `coverage --compile`) | "Abre sin avisos" y L4 se comprueban sin ejecutar |
| 5 | **Matriz de dominio** por componente: L1/L2 hecho (`coverage.ts` + `coverage-summary.ts`). L3 y L4: se miden con el **montaje** (origen y destino) y los parametros obligatorios del XML. Pendiente L5 (ejecutar con la salida esperada) | Se sabe cuantos componentes estan al 100 %, y por que fallan los demas |
| 6 | **Tests del bridge aislados**: hechos (hecho) | `bun test` verde con y sin Studio |
| 7 | **Indice de definiciones de los componentes**: hecho (`talend_components_definition`, `scripts/component-definitions.ts`). Pendiente: que lo usen las tools que configuran (hoy es el plan de la cobertura) | Un agente sabe que poner en cada componente sin adivinar |

### Resultado de la primera medicion (L1/L2)

El catalogo (1294 entradas) incluye 397 variantes de Spark/Streaming; los 897 componentes Standard fallan solo por una causa:

- **20 sin runtime** (`components-jdbc-runtime:0.37.61`, familias Athena, Databricks SQL, Redshift):
  Studio los resuelve desde un repositorio que aqui no responde. Hay que averiguar de donde los
  baja Studio (configuracion de Maven/Nexus de Talend) y si hace falta red o credenciales.
- **Variantes de Spark y Streaming** (397 de las 1294 entradas del catalogo): son otro tipo de job, no fallos. **Falta soporte para tipos de job** (Spark Batch, Spark Streaming, Structured Streaming); hoy `create` solo crea jobs Standard.

## 3. P1: el modelo completo de un job

Hoy se crean nodos, conexiones FLOW, schema y parametros. Falta lo que hace un job *real*:

- **Conexiones y triggers**: tipos `FLOW`, `REJECT`, `FILTER`, `ITERATE`, `LOOKUP`; triggers
  `OnSubjobOk/Error`, `OnComponentOk/Error`, `RunIf`; validar que la conexion es legal para el
  par de componentes; subjobs y nodos de inicio.
- **Contextos en vivo**: grupos, variables, tipos, valores por entorno, `tContextLoad`. Hoy las
  tools de contexto leen archivos; falta editarlos con la API de Studio.
- **Metadata del repositorio**: conexiones a base de datos, esquemas de archivo (delimitado,
  Excel, JSON, XML), esquemas genericos, y **usarlos en los nodos** (propiedad "Repository" en vez
  de "Built-in"). Es indispensable para todos los `tDB*`.
- **Joblets, rutinas y librerias**: crear y usar joblets; rutinas Java propias; jars de terceros;
  test cases.
- **Gestion de jobs**: versiones nuevas, carpetas, renombrar, mover, duplicar, dependencias
  entre jobs (padre/hijo con `tRunJob` y paso de parametros).
- **Lienzo**: posicionamiento automatico, notas y comentarios, documentacion del job.

## 4. P2: componentes complejos (por familia, de mayor a menor valor)

| Familia | Estado | Bloqueo / siguiente paso |
|---|---|---|
| Archivos delimitados y planos | Validado | Rendimiento (500 mil filas) y encodings |
| `tMap` | `.item` correcto, no compila | Falta `talend-tmap-dataset-1.2.16.jar` (Talend Exchange). Probar `talend_studio_install_modules` y el repositorio de modulos de Talend; sin eso, no hay `tMap` |
| Transformaciones (`tFilterRow`, `tSortRow`, `tAggregateRow`, `tUniqRow`, `tJoin`, `tUnite`, `tNormalize`...) | Las tablas se rellenan con el plan (columnas y valores por defecto) y **compilan** | Falta la fila real: que condicion poner en cada fila (`CONDITIONS` del tFilterRow, `CRITERIA` del tSortRow) y como se ejecuta con la condicion |
| Bases de datos (`tDB*`) | Sin probar | Postgres (en la nube o Docker), drivers, conexion compartida, commit/rollback, acciones de salida |
| Excel, posicional, JSON, XML, Parquet, Avro | Posicional y JSON no compilan en 8.0.1 | Investigar `DIE_ON_ERROR` del catalogo vs el del nodo (seccion 24 de INTERNALS) y buscar el camino que si genera |
| Control de flujo | `tPrejob`, `tPostjob`, `tRunJob` ok | `tFileList`, `tFlowToIterate`, `tDie`, `tWarn`, `tLogCatcher`, `tSetGlobalVar` |
| Nube y APIs | Sin probar | `tRESTClient`, `tHTTP*`, S3, Azure, GCS, Salesforce, Snowflake |
| Big Data, ESB, MDM, DQ | Sin probar | Decidir alcance segun la licencia de Studio; DQ ya tiene tools de lectura |

Prioridad: cobertura de **toda** la familia mas usada antes de ir a la siguiente.

## 5. P3: ciclo de vida completo

- **Ejecutar con parametros**: contexto, valores por llamada, timeout, salida estructurada,
  contadores de filas (`tStatCatcher`) y logs.
- **Harness de aserciones**: cada prueba declara la salida esperada antes de correr y compara
  (archivos "golden", conteos, checksums).
- **Build y exportacion**: Build Job (zip autonomo), imagen Docker/OSGi.
- **Publicar en Talend Cloud (TMC)**: API REST de Talend Management Console (artefactos, tareas,
  planes, engines). Es una API distinta, hoy sin conectar.
- **Git y proyectos**: ramas, commits, conflictos de `.item`, cambio de proyecto y workspace.
- **Migraciones**: pipeline spec -> job en Studio (la fase 8, SAS a Talend, comparando fila a fila).

## 6. P4: robustez de un agente que automatiza todo

- **Deshacer**: instantanea del job antes de mutar y `restore`; `dryRun` con diff antes de aplicar.
- **Round-trip**: leer un job real a un spec declarativo con la misma forma que recibe `add_node`.
  Es la base de "aprender de un archivo real" sin depender de el.
- **Seguridad**: `readOnly` hoy no protege las rutas que crean y borran jobs y nodos; aplicarlo a
  todas las escrituras. Secretos fuera del `.item`.
- **Compatibilidad**: detectar la version de Studio y probar en otras (7.3, 8.0.x, 2024+) y SO.
- **Conocimiento**: generar `docs/COMPONENTES/<familia>.md` desde la matriz de cobertura
  (parametros, trampas, ejemplo) para que un agente no empiece de cero con cada componente.
- **Observabilidad**: latencia por ruta, errores del bridge y estado de la UI.

## 7. Orden recomendado (los 5 siguientes pasos)

1. ~~Identidad del job, alta verificada, cobertura que mide~~ (hecho).
2. L3 y L4 medidos con el montaje y los parametros obligatorios del XML. **L5** (ejecutar con la salida
   esperada, por familias) es lo que falta: es el nivel que de verdad prueba que el job sirve.
3. Tipos de job (Spark, Streaming) y los runtimes que faltan.
4. P1: conexiones/triggers y metadata del repositorio (abre los `tDB*`).
5. P2: el `tMap` (modulo) y las filas reales de las tablas de transformacion (las columnas ya se rellenan; falta
   saber que condicion poner en cada fila).

## 8. Lo que hace falta de ti

- Acceso al modulo `talend-tmap-dataset` o al repositorio de modulos de Talend (o credenciales de
  Talend Exchange).
- Una base de datos de pruebas (Postgres) y sus credenciales de prueba.
- Un programa SAS pequeno real para la fase 8.
- Que familias y ediciones de Talend entran en alcance (Big Data, ESB, MDM, Cloud).
- Credenciales de TMC si se quiere publicar en la nube.
