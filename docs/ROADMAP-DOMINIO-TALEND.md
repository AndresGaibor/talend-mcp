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
parametros obligatorios que declara el XML de la instalacion. En total hay **259 componentes medidos a L3/L4, de
los que 216 compilan (83 %)**: las nueve familias mas usadas (134, de los que 99 compilan) y las que no piden
artefacto (125, de los que 117 compilan). Los que no compilan son, sobre todo, las mitades de un par
(`tAggregateIn`, `tSortIn`...) que necesitan su pareja, y los que necesitan una configuracion real (tablas de
transformacion, contexto). L5 (ejecutar con la salida correcta) esta validado con un arnes de escenarios
(`scripts/execution-check.ts`): **20 en verde y ninguno pendiente** (humo, leer un CSV, leer y escribir un CSV,
quitar duplicados, un `tFilterRow`, un `tUnite`, un `tMap`, escribir un JSON, leer un JSON, listar los ficheros
de una carpeta, un trigger de error, contextos, orquestacion padre/hijo, un `tAggregateRow`, escribir en un
Postgres, un `tJavaRow`, un `tNormalize`, un `tRowGenerator` y un `tFilterColumns`).

### Las definiciones de los componentes, sin abrir Studio

Lo que un componente exige esta en su XML (`<nombre>_java.xml`), en la instalacion de Studio. El indice de esas
definiciones es lo que permite configurar cualquier componente sin adivinar:

- `talend_components_definition` (tool) y `scripts/component-definitions.ts` (script) dicen que parametros son
  obligatorios, con que valor se rellenan, que conexiones admite y que artefactos necesita.
- El plan de montaje (`planMount`) se le pasa al bridge: con el, la cobertura mide L3 y L4 de verdad.
- Las tablas de los parametros (`FORMATS`, `CONDITIONS`, `CRITERIA`) se rellenan con las columnas del schema:
  con eso, `tFilterRow`, `tSortRow` y `tAggregateRow` ya compilan. El `tAggregateRow` ademas **ejecuta** con la
  salida esperada verificada, con las cuatro reglas de INTERNALS 41.

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
| 5 | **Matriz de dominio** por componente: L1/L2 hecho (`coverage.ts` + `coverage-summary.ts`). L3 y L4 **hechos** con el **montaje** (origen y destino) y los parametros obligatorios del XML: **259 medidos, 216 compilan**. L5 **hecho en 18 escenarios (los 18 en verde, ninguno pendiente)**; falta medir las familias de base de datos que piden un driver | Se sabe cuantos componentes estan al 100 %, y por que fallan los demas |
| 6 | **Tests del bridge aislados**: hechos (hecho) | `bun test` verde con y sin Studio |
| 7 | **Indice de definiciones de los componentes**: hecho (`talend_components_definition`, `scripts/component-definitions.ts`). Pendiente: que lo usen las tools que configuran (hoy es el plan de la cobertura) | Un agente sabe que poner en cada componente sin adivinar |
| 8 | **Metadata del repositorio**: conexiones de base de datos y esquemas de archivo, que es lo que abre los `tDB*` en modo "Repository". **Pendiente**: en Talend 8 no se ha encontrado la clase del modelo de las conexiones compartidas de base de datos. **No es bloqueante**: los jobs se montan en modo "built-in" (HOST, PORT, USER y PASS en el propio componente) y asi funcionan (Postgres, MySQL, MS SQL Server y Oracle ya compilan, y el Postgres ya lee y escribe) | Un `tDB*` puede tomar la conexion del repositorio en vez de del propio componente |

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
  par de componentes; subjobs y nodos de inicio. **El validador de conector esta hecho**
  (`talend_job_connect_nodes` lo comprueba contra la definicion del componente, INTERNALS 32).
- **Contextos en vivo**: grupos, variables, tipos, valores por entorno, `tContextLoad`. **Hecho**: los
  contextos de un job se listan, crean, editan y borran con la API de Studio
  (`talend_job_contexts_list`, `talend_job_context_create`, `talend_job_context_set`,
  `talend_job_context_delete`, `talend_job_context_delete_variable`), y el relanzamiento les inyecta los
  valores. Los contextos **del proyecto** se listan y se borran; crearlos no (Studio no deja enganchar el
  entorno a un item recien creado). Falta el `tContextLoad` con los valores del entorno.
- **Metadata del repositorio**: conexiones a base de datos, esquemas de archivo (delimitado,
  Excel, JSON, XML), esquemas genericos, y **usarlos en los nodos** (propiedad "Repository" en vez
  de "Built-in"). Es lo que abre los `tDB*` en modo "Repository": la parte de las conexiones
  compartidas de base de datos sigue pendiente (P0, fila 8) y, mientras tanto, el modo "built-in"
  (HOST, PORT, USER y PASS en el propio componente) es lo que funciona.
- **Joblets, rutinas y librerias**: crear y usar joblets; rutinas Java propias; jars de terceros;
  test cases.
- **Gestion de jobs**: versiones nuevas, carpetas, renombrar, mover, duplicar, dependencias
  entre jobs (padre/hijo con `tRunJob` y paso de parametros).
- **Lienzo**: posicionamiento automatico, notas y comentarios, documentacion del job.

## 4. P2: componentes complejos (por familia, de mayor a menor valor)

| Familia | Estado | Bloqueo / siguiente paso |
|---|---|---|
| Archivos delimitados y planos | Validado a L5 | Rendimiento (500 mil filas) y encodings |
| `tMap` | **Validado a L5**: renombra y filtra, con la salida esperada verificada. Compila y ejecuta **sin** el `talend-tmap-dataset` | Solo falta el jar del Exchange para el editor visual del mapper |
| Transformaciones (`tFilterRow`, `tSortRow`, `tAggregateRow`, `tUniqRow`, `tJoin`, `tUnite`, `tNormalize`...) | Las tablas se rellenan con el plan (columnas y valores por defecto) y **compilan**. **Ejecutan bien** el `tUniqRow`, el `tSortRow`, el `tFilterRow`, el `tUnite`, el `tMap`, el `tAggregateRow` (este ultimo con las cuatro reglas de INTERNALS 41) y el `tNormalize` (que parte una columna en filas; la entrada y la salida declaran las columnas con el mismo nombre, INTERNALS 49) | El `tJoin` |
| Bases de datos (`tDB*`) | **Postgres probado a L5**: lee (`tPostgresqlInput`) y escribe (`tPostgresqlOutput`, con `AUTO_COMMIT=true` en la conexion compartida). Compilan Postgres, MySQL, MS SQL Server y Oracle | Medir las familias que faltan: DB2, Informix, Vertica, Greenplum, Teradata, Netezza, Sybase, Ingres (y las que piden un jar que no esta en el `.m2`). Sin probar: `tDBCommit`/`tDBRollback` explicitos y las demas acciones de tabla (`TABLE_ACTION`) |
| Excel, posicional, JSON, XML, Parquet, Avro | **JSON validado a L5**: la lectura (`tFileInputJSON`, con `JSON_LOOP_QUERY` y la tabla `MAPPING_JSONPATH`) y la escritura (`tFileOutputJSON`). Posicional no compila en 8.0.1 | XML, Parquet y Avro sin probar |
| Control de flujo | `tPrejob`, `tPostjob`, `tRunJob` y el trigger de error, ok (L5). El `tFileList` tambien (L5), con su peculiaridad: **no emite filas**, deja los valores en el `globalMap` (INTERNALS 47) | `tFlowToIterate`, `tDie`, `tWarn`, `tLogCatcher`, `tSetGlobalVar` |
| Nube y APIs | Sin probar | `tRESTClient`, `tHTTP*`, S3, Azure, GCS, Salesforce, Snowflake |
| Big Data, ESB, MDM, DQ | Sin probar | Decidir alcance segun la licencia de Studio; DQ ya tiene tools de lectura |

Prioridad: cobertura de **toda** la familia mas usada antes de ir a la siguiente.

### Lo que el bridge ya resuelve (para que las filas lleguen al generador)

Cuatro arreglos del plugin Java (INTERNALS 42, 43, 44 y 46) hacen que las transformaciones y la escritura en base de
datos generen codigo, y estan hechos:

- **El esquema se aplica despues de conectar**: al conectar, Talend propaga el esquema del destino hacia atras y
  se lleva las columnas del origen. En el arnes, los nodos marcados `schemaDespuesDeConectar` se aplican al final.
- **La tabla de rechazo (`REJECT`) de un nodo se restaura sola** si ha quedado con las columnas de otro
  componente: si no, el generador falla con un `Index N out of bounds`.
- **El nombre de la columna en la base de datos** (`setOriginalDbColumnName`): sin el, el `tDBOutput` genera el
  `INSERT` con los nombres de columna a `null` y el Postgres lo rechaza. Y los parametros de lista cerrada
  (`CLOSED_LIST`, `COMPONENT_LIST` y `PREV_COLUMN_LIST`) ya no se entrecomillan, que hacia que el `TABLE_ACTION`
  no se ejecutara.
- **Las celdas de tabla que son nombres van sin comillas** (`COLNAME`, `INPUT_COLUMN`, `OUTPUT_COLUMN`, `FUNCTION`,
  `OPERATOR`, `SORT`, `ORDER`, `SCHEMA_COLUMN`...) y las demas como literales Java, como hace el IDE. Asi la consulta
  JSONPath de un `tFileInputJSON` sale como `"$.clientes[*].id"` y compila.

## 5. P3: ciclo de vida completo

- **Ejecutar con parametros**: contexto, valores por llamada, timeout, salida estructurada,
  contadores de filas (`tStatCatcher`) y logs.
- **Harness de aserciones**: **hecho**: el arnes de L5 declara la salida esperada antes de correr y compara
  (lineas exactas, lineas que tienen que aparecer, el fichero que escribe y una consulta a la base de datos).
  Falta una suite que lo corra en automatico y que guarde los "golden".
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
2. ~~L3 y L4 medidos con el montaje y los parametros obligatorios del XML~~ (hecho: **259 medidos, 216
   compilan**). **L5** va por familias, con **20 escenarios en verde y ninguno pendiente**.
3. **Medir las familias de base de datos que faltan** (DB2, Informix, Vertica, Greenplum, Teradata, Netezza,
   Sybase, Ingres) y las que piden un jar que hay que instalar antes
   (`--components <lista> --compile --out <csv>`). Primer intento hecho con 17 familias de "DB Specifics"
   completas (77 componentes): **32 compilan y 45 no**, pero el resultado **no vale como medicion**: a mitad de
   la corrida se rompio el agregador Maven de Studio (`Child module ... does not exist`, INTERNALS 51) y 42 de
   esos 45 fallos son ese error, no el componente. De los 3 restantes, uno es real (`tCosmosDBClose`:
   `com.mongodb cannot be resolved`; falta el driver) y dos son timeouts de la interfaz. **Hay que repetirla por
   tandas** (una o dos familias por corrida, reiniciando Studio entre tandas).
4. Tipos de job (Spark, Streaming) y los runtimes que faltan.
5. P0/P1: las conexiones compartidas de base de datos del metadata del repositorio (mientras tanto, modo
   "built-in") y las filas reales de las tablas de transformacion.

## 8. Riesgos conocidos

- **Los drivers de base de datos hay que instalarlos a mano**. El build de Maven de Studio corre en modo
  *offline*: si el driver no esta en su `.m2`, el componente no compila ni ejecuta. Los que se pueden bajar de
  Maven Central se instalan con `talend_studio_install_artifact`; los que no, no se pueden instalar desde aqui.
- **Talend Exchange no resuelve en DNS desde esta maquina** (`exchange.talend.com` y `components.talend.com`):
  el `talend-tmap-dataset` (el jar del `tMap`) hay que instalarlo desde el propio Studio ("Additional
  components") o copiando el jar a mano al `.m2`. **No es un bloqueo**: el `tMap` genera codigo y ejecuta sin
  ese jar (solo lo necesita el editor visual del mapper).
- **El heap de Studio se llena** con las mediciones largas: hay que reiniciar Studio entre sesiones de medicion.
  La medicion cancela sola al 80 % del heap y se vigila con la tool `talend_studio_memory`.
- **Este workspace no abre los jobs de Big Data** (Spark Batch y Streaming), ni los del usuario ni los del MCP:
  es un estado del repositorio del proyecto, no del MCP.
- **Studio no deja crear los contextos del proyecto** (ni enganchar el entorno a un item recien creado): se
  listan, se leen y se borran, pero no se crean.

## 9. Lo que hace falta de ti

- Acceso al modulo `talend-tmap-dataset` o al repositorio de modulos de Talend (o credenciales de
  Talend Exchange).
- Una base de datos de pruebas (Postgres) y sus credenciales de prueba.
- Los drivers de las bases de datos que todavia no se han medido (DB2, Informix, Vertica, Greenplum, Teradata,
  Netezza, Sybase, Ingres), si se quieren medir esas familias. Los de Maven Central se instalan con
  `talend_studio_install_artifact`; el build de Maven de Studio corre en modo *offline* y sin el driver en su `.m2`
  el componente no compila.
- Un programa SAS pequeno real para la fase 8.
- Que familias y ediciones de Talend entran en alcance (Big Data, ESB, MDM, Cloud).
- Credenciales de TMC si se quiere publicar en la nube.
