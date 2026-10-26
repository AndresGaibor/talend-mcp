# Handoff: automatizar Talend Studio con el MCP

> Documento de traspaso entre sesiones. La fuente de verdad son el roadmap
> ([ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md)), el estado de las pruebas
> ([PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md)) y los descubrimiento sobre Studio
> ([TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md)).

## Objetivo

Controlar Talend Studio por completo desde el MCP: crear jobs, anadir y configurar cualquier componente, hasta
lo mas complejo. El dominio se mide con una matriz **componente x nivel** (L1 crear, L2 configurar, L3 conectar,
L4 compila, L5 ejecuta con la salida esperada).

## Documentacion a leer primero

1. `docs/GUIA-AGENTE.md`: como usar el MCP, el flujo, los errores y los limites.
2. `docs/ROADMAP-DOMINIO-TALEND.md`: el plan priorizado (P0 a P4).
3. `docs/TALEND-STUDIO-INTERNALS.md`: las secciones 41 a 50 son las nuevas (el `tAggregateRow`, la propagacion del
   esquema al conectar, el nombre de la columna en la base de datos, los parametros de lista, como se escribe
   en una base de datos, los valores de las celdas de tabla, el `tFileList`, el `tFileInputJSON`, el `tNormalize`
   y el `tJavaRow`).
4. `docs/PLAN-DE-PRUEBAS.md`: el estado por fase y por familia.
5. `docs/COBERTURA-POR-FAMILIA.md`: el mapa de cobertura por familia y el orden de las proximas tandas.
6. `docs/REFACTOR-PENDIENTE.md`: estado de las suites incrementales y candidatos a dividir por responsabilidad.
7. `AGENTS.md`: reglas del repo.

## Estado del repo

- Rama `main`, al dia con el remoto. `bun test` verde (304 tests). `bun run typecheck` pasa.
- Los tests de integracion contra el Studio real solo corren con `TALEND_BRIDGE_INTEGRATION=1`
  (`tests/integration/`). Con y sin Studio, `bun test` es verde.
- **Hay cambios sin commitear** en el arbol de trabajo: la puesta al dia de los cuatro documentos de estado
  (este `HANDOFF`, el `PLAN-DE-PRUEBAS`, la `GUIA-AGENTE` y el `ROADMAP`), las secciones 40 y 53-54 de INTERNALS,
  el plugin Java del bridge (`NodeOperations`, `JobExecutor`, `SchemaOperations`), el arnes
  (`scripts/execution-check.ts`) y el fixture de escenarios, con los **28 escenarios L5 en verde**.

## Comandos de trabajo

| Que se quiere | Como |
|---|---|
| Ejecutar los escenarios L5 | `bun run scripts/execution-check.ts [filtro]` (el informe sale en `testdata/resultados-l5.csv`) |
| Medir componentes a L4 | `bun run scripts/coverage.ts --components <lista> --compile --out <csv>` (tambien `--family`, `--max`, `--cancel`) |
| Recompilar el plugin Java | `bun run bridge:install` (**no** con una medicion en marcha) |
| Llamar al bridge a pelo | `bun run scripts/bridge-call.ts /ruta @fichero.json` |
| Llamar a una tool del MCP | `bun run scripts/mcp-call.ts <tool> @fichero.json` |
| Comprobar el repo | `bun run typecheck` y `bun test` |

## Entorno (Windows)

- Bun: `$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"`.
- JDK de Studio: `JAVA_HOME=C:\Talend\8.0.1\zulu21.50.19-ca-jdk21.0.11-win_x64`.
- Studio abierto; el bridge escucha en `127.0.0.1:3930` con token en `~/.talend-bridge/token`.
  `~/.talend-bridge/config.json` tiene `unsafeActions: true`.
- Compilar y recargar el plugin Java en caliente, sin reiniciar Studio (~5 s):
  ```bash
  bun run bridge:install
  ```
- Llamar al bridge directo: `bun run scripts/bridge-call.ts /ruta @archivo.json`. En PowerShell hay que pasar el
  JSON por archivo, porque las comillas en linea se pierden.
- Para editar codigo Java con `\\` usa la herramienta Edit (las plantillas JS y `sed` pierden las barras).
- **No recompiles el bridge con una medicion en marcha**: al recargar el plugin se pierde el estado en memoria de
  la medicion y se acaba ("La medicion termino en estado 'none'").

## Lo que se ha hecho en esta sesion

### Las definiciones de los componentes, en disco (sin Studio)

Cada componente declara en su XML (`<nombre>_java.xml`, en la instalacion de Studio) que parametros son
obligatorios, con que valor, cuando se ven, que conexiones admite y que artefactos necesita.

- Nuevo modulo `src/modules/component-definitions/`: indice de las definiciones (1175 leidas, 777 de las Standard),
  plan de relleno de los parametros obligatorios y eleccion del conector de entrada y de salida.
- Nueva tool `talend_components_definition` y el script `scripts/component-definitions.ts`.
- Los parametros que Studio no declara como obligatorios (su `isRequired` es generoso) salen del XML.

### La cobertura mide L3 y L4 de verdad

`scripts/coverage.ts` monta cada componente en un job minimo (un `tFixedFlowInput` con schema si consume, un
`tLogRow` si el generador lo pide) y le rellena los parametros obligatorios del plan:

- `tFileOutputDelimited`, `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` y `tFileOutputPositional`
  compilan (antes no: faltaba el `FILENAME` o el schema).
- `tFilterRow`, `tSortRow` y `tAggregateRow` compilan: sus tablas se rellenan con las columnas del schema.
- Los componentes de la generacion nueva (`JDBCInput` y compañía) compilan: el destino se anade cuando el
  generador dice "Missing output connection".
- Opciones: `--family`, `--components`, `--con-definicion`, `--max`, `--compile`, `--cancel`.
- Los componentes sin artefacto local tardan ~50 s cada uno (el generador busca el artefacto en Maven): por eso
  el catalogo entero no se mide de una vez.

**Donde esta la medicion**: **259 componentes medidos a L3/L4, de los que 216 compilan (83 %)**, mas las **25
familias de `Databases/DB Specifics`**: **179 componentes, 177 compilan (99 %)**. Fallan solo `tCosmosDBClose`
(pide el driver de MongoDB) y `tIngresBulkExec` (codigo generado roto). El detalle esta en
`testdata/cobertura-l4-*.csv`.

Dos lecciones de esa medicion. Primera: **el driver de la base no hace falta para compilar**, solo para ejecutar
(INTERNALS 52), asi que L4 de las familias de BD se mide sin instalar nada. Segunda: si el heap de Studio pasa del
80 %, el agregador Maven sale mal y **todos** los componentes siguientes fallan con `Child module ... does not
exist`, aunque esten bien; la primera corrida asi dio 32 de 77, y con una **recoleccion forzada** en
`coverage.ts` (cada vez que pasa del 60 %) y midiendo por tandas salieron 177 de 179 (INTERNALS 51).

### El bridge: cuatro arreglos con efecto practico

Los cuatro son del plugin Java (se publican con `bun run bridge:install`) y estan explicados
en INTERNALS 42, 43, 44 y 46:

1. **El nombre de la columna en la base de datos** (`setOriginalDbColumnName`): sin el, el `tDBOutput` genera el
   `INSERT` con los nombres de columna a `null` y el Postgres lo rechaza. Se pone en los dos caminos que crean
   columnas (`ComponentConfigurator` y `SchemaOperations`): si solo se pusiera en uno, el esquema se contagia por
   la conexion y el bug vuelve.
2. **Los parametros de lista no se entrecomillan**: `CLOSED_LIST`, `COMPONENT_LIST` y `PREV_COLUMN_LIST` van sin
   comillas (con comillas, el `TABLE_ACTION` de un `tDBOutput` valia `"TRUNCATE"` y la accion de tabla no se ejecutaba).
3. **La tabla de rechazo (`REJECT`) se restaura sola**: si un nodo se queda con las columnas de otro componente, el
   bridge la deja con las dos de error (`errorCode` y `errorMessage`) en vez de dejar al generador con un
   `Index N out of bounds`.
4. **Las celdas de tabla que son nombres van sin comillas** (`SCHEMA_COLUMN`, `COLNAME`, `INPUT_COLUMN`,
   `OUTPUT_COLUMN`, `FUNCTION`, `OPERATOR`, `SORT`, `ORDER`, `KEY_ATTRIBUTE`, `CASE_SENSITIVE`, `PARAMETER_NAME`,
   `TARGET_COLUMN`); las demas, como literales Java, como hace el IDE. Asi la consulta JSONPath de un
   `tFileInputJSON` sale como `"$.clientes[*].id"` y compila.

### Conectar bien (un bug que rompia muchos jobs)

El **nombre** de la conexion (`row1`, `row2`...) es la variable de la fila en el codigo generado, y las tablas de
los componentes la referencian (`row1.monto`). El bridge la llamaba `conn_1` y las transformaciones no generaban
codigo. Ademas, el **conector** no siempre es `FLOW`: el `tUniqRow` saca sus filas por `UNIQUE`. Ver INTERNALS 32.

### Arnes de ejecucion (L5): 28 de 28 en verde

`scripts/execution-check.ts` monta un job, lo ejecuta y **compara la salida con la esperada** (declarada antes de
ejecutar). Los escenarios estan en `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`; el informe sale en
`testdata/resultados-l5.csv`. **Veintiocho escenarios en verde**: el de humo, el de leer un
CSV, el de leer y escribir un CSV, el de transformaciones (`tUniqRow` + `tSortRow` sobre el CSV, quitando el
duplicado y ordenando por importe), el `tFilterRow` con condicion, el `tUnite`, el `tMap` que renombra y filtra,
la escritura de un JSON, la lectura de un JSON, el listado de los ficheros de una carpeta, el trigger de error, los
contextos, la orquestacion padre/hijo, el `tAggregateRow`, la escritura en Postgres, la lectura de Postgres, el
`tJavaRow`, el `tNormalize`, el `tRowGenerator`, el `tFilterColumns`, el **update con clave y commit explicito**,
el **delete con clave**, el **`tDie` que corta el job**, el **rollback explicito**, el **`tPrejob`/`tPostjob`** y el
**`tWarn` que avisa y no corta**, **`tFlowToIterate`** (dos filas, dos iteraciones) y **`tSetGlobalVar`** (la variable se lee desde un `tJavaRow` en el flujo). **Ninguno pendiente.**

Los ocho ultimos, y lo que ensenaron:

- **"bases de datos: actualizar con clave y commit explicito"**: `tPostgresqlOutput` con `ACTION=UPDATE` y su
  `UPDATE_KEY`, y el `tPostgresqlCommit` colgado con `OnSubjobOk` **del arranque del subjob** (no del output):
  Studio solo emite los triggers que salen del primer componente del subjob (INTERNALS 53). La conexion va con
  `AUTO_COMMIT=false`; sin el commit los cambios no llegan.
- **"bases de datos: borrar con clave"**: `ACTION=DELETE` con `DELETE_KEY`; la tabla la recrea el escenario en
  `prepara` para no depender de lo que hubiera.
- **"control de flujo: un tDie corta el job"**: el `tDie` corta con codigo 1. Es tambien el fallo que usa el
  escenario del trigger de error: un `tFileInputDelimited` sin fichero **no** dispara el manejador (registra
  `[ERROR]` y termina con codigo 0).
- **"bases de datos: deshacer con rollback explicito"**: el mismo `tPostgresqlOutput` con `UPDATE_KEY`, pero en
  vez de commit un `tPostgresqlRollback` colgado con `OnSubjobOk` del arranque del subjob. La consulta de
  comprobacion ve el valor **anterior**: el rollback deshace el update de verdad.
- **"control de flujo: un tPrejob y un tPostjob"**: `tPrejob` y `tPostjob` solo tienen conector `COMPONENT_OK`
  (no `FLOW`), asi que cada uno se cuelga de su propio `tFixedFlowInput` con `OnComponentOk` y los tres subjobs
  escriben en el mismo fichero (`APPEND`). El orden comprobado es `pre`, `principal`, `post`: el arnes compara las
  lineas exactas del fichero, no solo que aparezcan. El primer subjob escribe con `FILE_EXIST_EXCEPTION=false`
  porque el Run de Studio deja el fichero escrito antes del relanzamiento.
- **"control de flujo: convertir filas en iteraciones"**: `tFlowToIterate` convierte cada fila en una iteracion,
  guarda sus valores con claves como `row1.id` y `row1.nombre` en `globalMap`, y la conexion al `tJava` es de tipo
  `ITERATE`. El `tJava` imprime una linea por iteracion.
- **"codigo: guardar y leer una variable global"**: `tSetGlobalVar` guarda las celdas de `VARIABLES` como
  literales Java. Su consumidor debe ejecutarse por fila en el flujo; el `begin` de un `tJava` se ejecuta antes de
  procesar la entrada. `tJavaRow` imprime el valor después de `tSetGlobalVar`.

Ademas, el arnes reintenta mientras Studio compila tanto en la espera como en la ejecucion final (`no esta
compilado` y `No se encontro la clase principal`), reabre el job y repite el `addNode` cuando Studio contesta
`No se pudo abrir el job ... en el editor` (es transitorio: tambien le pasa con jobs del usuario) y reintenta un
`addNode` que vuelve sin nombre cuando Studio esta ocupado.

Los escenarios que se cerraron en las ultimas tandas:

- **"transformaciones: agregar por ciudad"** (`tAggregateRow`): funciona con las cuatro reglas de INTERNALS 41 (la
  tabla de salida va la primera, el origen se queda con una sola tabla, las tablas del agregado usan el nombre
  simple de la columna y el numero de columnas del origen tiene que ser el de la salida). El dato de entrada es
  `testdata/l5_ventas.csv` (`ciudad;monto;cliente`).
- **"bases de datos: escribir en un Postgres y verificar"** (`tPostgresqlOutput`): el escenario **no usa un
  componente de commit**: la conexion compartida va con `AUTO_COMMIT=true`. El `tDBOutput` no hace commit por su
  cuenta, y si se encola un `tPostgresqlCommit` se ejecuta dentro del bucle de filas, cierra la conexion y el lote
  final falla. Los pasos, en INTERNALS 45.
- **"codigo: un tJava toca la fila"** (`tJavaRow`): el codigo (`CODE`) se inserta tal cual, con `input_row` y
  `output_row` sustituidos por el nombre de las conexiones; la salida la define el esquema del nodo, que hay que
  aplicar **despues de conectar**. Y las columnas enteras que no admiten nulos hay que evitarlas (INTERNALS 50).
- **"transformaciones: un tNormalize parte una columna en filas"**: el generador copia las columnas de la salida
  desde las de la entrada **por su nombre**, asi que la entrada y la salida declaran las mismas columnas
  (INTERNALS 49).

Y los dos de la ultima tanda:

- **"archivos: leer un JSON"** (`tFileInputJSON`): con `READ_BY=JSONPATH`, la raiz del bucle va en
  `JSON_LOOP_QUERY` (`LOOP_QUERY` es del modo `XPATH`) y el mapeo en la tabla `MAPPING_JSONPATH`. El valor de la
  celda `QUERY` es un literal: va con comillas, como lo escribe el IDE. El `pom` del job ya hereda las librerias
  del componente. INTERNALS 48.
- **"archivos: listar los ficheros de una carpeta"** (`tFileList`): en Talend 8 **no emite filas** (su conector
  `FLOW` es `MAX_OUTPUT=0`): lo que deja son valores en el `globalMap` (`<uniqueName>_CURRENT_FILE`,
  `_CURRENT_FILEPATH`, ...). El escenario lo lee con un `tJavaRow`. Ademas, su `LIST_MODE` es el **tipo de
  listado** (`FILES`, `DIRECTORIES`, `BOTH`), no el orden: con `"ASC"` ahi no lista nada. INTERNALS 47.

Ademas, el de bases de datos de lectura: un `tPostgresqlConnection` + `tPostgresqlInput` que lee del Postgres de
pruebas (Docker, `testdata/docker-compose.yml`, puerto 5433). Los tres detalles que hay que recordar estan en
INTERNALS 35: el driver tiene que estar en el `.m2` de Studio con la version exacta, la `QUERY` necesita
`literal: true` y la `CONNECTION` necesita `literal: false`.

Un escenario puede declarar jobs auxiliares (`jobs`): se montan y compilan antes que el principal, que es lo que
hace falta para que un `tRunJob` pueda llamar a su hijo.

**Cambios en el arnes**:

- Los esquemas "despues de conectar" (`schemaDespuesDeConectar`) se aplican **con los nodos ORIGEN al final**:
  al conectar, Talend propaga el esquema del destino hacia atras y se lleva las columnas del origen, asi que el
  esquema del origen hay que ponerlo despues, como hace el IDE.
- `FIELD_OPTIONS` (las columnas que se escriben en una base de datos) va en `tablas`, no en `parameters`: es un
  parametro de tipo TABLE.
- Los valores de las celdas de tabla que son nombres van sin comillas y los demas como literales (INTERNALS 46):
  lo aplica el bridge (`ComponentConfigurator.valorDeCelda` y `esNombreDeCelda`).

**Lo que queda pendiente de L5: nada.** El `tWarn` (el ultimo que faltaba) ya esta en verde: va como subjob
propio con `OnSubjobOk` desde el arranque y compila solo si el `PRIORITY` lleva su `VALUE` (`4`), no el
   nombre `WARNING` (INTERNALS 57). El arnes ejecuta los 27.

### Otros arreglos de esta sesion

- **Los contextos de un job**, de punta a punta, con la API de Studio (crear entorno, poner variable con su valor
  en cada entorno, listar, borrar).
- **Los contextos del proyecto** (los items de tipo Contexts): antes las tools devolvian una lista vacia; ahora
  listan (con sus entornos y variables), leen y borran. Crearlos sigue sin poder (Studio no deja enganchar el
  entorno a un item recien creado) y la tool lo dice y borra lo creado.
- **Las tools de jobs** (`talend_jobs_list`, `talend_jobs_read`, `talend_jobs_create`): leen el proyecto y crean
  con la API de Studio. Antes usaban un repositorio vacio.
- **Los triggers**: el bridge pasaba el nombre "bonito" (`OnSubjobOk`) como conector de la conexion, y Studio
  no creaba nada (o la dejaba como flujo de datos y el job no compilaba). El conector es el tipo del catalogo
  (`SUBJOB_OK`) y el nombre es la etiqueta. Ademas, Studio solo genera la llamada si el trigger sale del
  arranque del subjob (INTERNALS 40 y 53). Hay dos escenarios L5 que lo comprueban: el trigger de error y el
  commit explicito con `OnSubjobOk`.
- **La conexion que Studio rechaza en silencio**: `CommandStack.execute` se salta los comandos cuyo
  `canExecute()` es `false` sin avisar, y el bridge respondia `ok`. Ahora comprueba `canExecute()` y verifica
  que la conexion quedo en el modelo.
- **La memoria**: Studio se queda sin memoria con las mediciones largas (INTERNALS 39). Ahora la medicion lo
  vigila y cancela al 80 % del heap, y hay la tool `talend_studio_memory`.
- **28 escenarios L5** con la salida verificada (ver PLAN-DE-PRUEBAS).

### Contextos (entornos) de un job

El MCP ya edita los contextos de un job con la API de Studio: listarlos, crear un entorno, poner o cambiar una
variable (con su valor en ese entorno) y borrarlos. Las tools son `talend_job_contexts_list`,
`talend_job_context_create`, `talend_job_context_set`, `talend_job_context_delete` y
`talend_job_context_delete_variable`. El `.item` queda como lo dejaria el IDE (INTERNALS 36).

Ojo: los valores de un contexto **no viajan en el codigo generado** (los inyecta el runtime), asi que un job
relanzado a mano no los ve. Para comprobar un contexto hay que leerlo del modelo, no de la salida del job. El
relanzamiento les pasa los valores como argumentos (`--context_type CLAVE=VALOR`).

### Contextos del proyecto

Las tools de contexto del repositorio eran huecas (devolvian una lista vacia y no creaban nada). Ahora
`talend_list_repository_contexts` y `talend_read_repository_context` listan los items de tipo Contexts con sus
entornos y variables (los entornos se leen del `.item`, porque la API del repositorio no llega a ellos), y
`talend_delete_repository_context` borra el item y sus archivos.

**Crear o editar un contexto del proyecto sigue sin poder**: Studio no deja enganchar el entorno a un item recien
creado (las referencias del item solo admiten cambios cuando ya esta guardado), y el item se queda sin
variables. La tool falla con un error claro y borra lo que habia creado, en vez de dejar basura en el proyecto.

### Las tools de jobs ya funcionan

`talend_jobs_list` y `talend_jobs_read` leen el proyecto del disco (no necesitan Studio): la lista trae nombre,
version, carpeta, fecha, tamano y numero de componentes de cada job; la lectura trae los componentes con sus
parametros y las conexiones. `talend_jobs_create` crea el job **con la API de Studio** (antes escribia el `.item`
a mano, lo que estaba prohibido).

De paso se borro el codigo muerto del modulo de jobs: cinco tools que no estaban registradas (sus casos de uso y
dos puertos sin uso) y el `job-runner` de `src/talend/execution` (tres funciones con TODO y sin usar). Se
registraron las dos tools de spec que si funcionan: `talend_jobs_validate_pipeline_spec` y
`talend_jobs_preview_pipeline_spec`.

### Comprobacion de conexiones

`talend_job_connect_nodes` comprueba, con las definiciones del XML, que el conector sea una salida del origen que
pueda emitir y que el destino tenga entrada de datos. Conectar por un conector que el componente no usa no da
error (el job compila y no sale ninguna fila), asi que la comprobacion evita un fallo silencioso.

## Resultados medidos

| Nivel | Resultado |
|---|---|
| L1/L2 | 877 de 897 componentes Standard (98 %). Fallan 20 sin runtime de Maven (`components-jdbc-runtime:0.37.61`) |
| L3/L4 | **259 componentes medidos**: las nueve familias mas usadas (134, de los que 99 compilan) y las que no piden artefacto (`Logs_Errors`, `XML`, `Data_Quality`, `File/Management`, `PostgreSQL`, `MySQL`, `Data_Quality/Matching`, `DB_SCD`, `MS_SQL_Server`, `Oracle`): 125 de ellos, 117 compilan. **216 de 259 compilan (83 %)**. Los que no, necesitan una configuracion real (tablas, XSD, columnas), no un jar. Aparte, las **25 familias de `Databases/DB Specifics`**: **179 componentes, 177 compilan (99 %)**; fallan `tCosmosDBClose` (driver de MongoDB) y `tIngresBulkExec` (codigo generado) |
| L5 | **28 escenarios con la salida verificada** (los 28 que ejecuta el arnes): humo, leer un CSV, leer y escribir un CSV, transformaciones con `tUniqRow` y `tSortRow`, un `tFilterRow` con condicion, un `tUnite`, un `tMap` que renombra y filtra, escribir un JSON, **leer un JSON**, **listar los ficheros de una carpeta**, un trigger de error, contextos, orquestacion padre/hijo, un `tAggregateRow`, **escribir en un Postgres y verificar**, **leer de un Postgres**, un `tJavaRow`, un `tNormalize`, **un `tRowGenerator`**, **un `tFilterColumns`**, **un update con clave y commit explicito**, **un delete con clave**, **un `tDie` que corta el job**, **un rollback explicito**, **un `tPrejob`/`tPostjob`**, **un `tWarn` que avisa y no corta**, **un `tFlowToIterate`** y **un `tSetGlobalVar`**. **No queda ninguno pendiente** |

## Lo siguiente (por prioridad)

1. ~~Medir las familias de base de datos a L4~~ (hecho). Las 25 familias de `Databases/DB Specifics` quedan
   medidas: **179 componentes, 177 compilan**. Los dos fallos: `tCosmosDBClose` (pide el driver de MongoDB) y
   `tIngresBulkExec` (codigo generado roto). Queda la **fase B** para lo que pide un jar que no esta: los drivers
   de DB2, Informix, Netezza y Greenplum solo existen en el repositorio de Talend; Vertica si esta en Maven Central
   (`com.vertica.jdbc:vertica-jdbc:12.0.4-0`) y se podria instalar con `talend_studio_install_artifact` (aunque,
   como el driver no hace falta para compilar, solo cambiaria L5). Y las familias que piden `hadoop-client`,
   `sapjco3` o el `talend-tmap-dataset` de Exchange.
2. **Metadata del repositorio** (conexiones de base de datos y esquemas de archivo), que es lo que abre los
   `tDB*` en modo "Repository". **No es bloqueante**: en Talend 8 no se ha encontrado la clase del modelo de las
   conexiones compartidas, asi que hoy los jobs se montan en modo "built-in" (HOST, PORT, USER y PASS en el
   propio componente) y asi funcionan.
3. **Limpiar los jobs de prueba que deja el arnes** (`MCP_L5_*`) y el `MCP_Coverage` de la medicion en el
   workspace de Studio: ya hay script, `bun run scripts/limpiar-mcp.ts` (`--simular` solo lista). Borra los jobs
   `MCP_*` por la API de Studio, las carpetas vacias que dejan y los proyectos Maven huerfanos que empiezan por
   `mcp` (no toca las carpetas del usuario).
4. **Medir lo que pide artefacto**: con `--sin-artefacto` la medicion se salta los componentes que piden un jar que
   no esta en el `.m2` de Studio. Los que faltan y se pueden bajar de Maven Central se instalan con
   `talend_studio_install_artifact` (y despues se miden). Los de **Talend Exchange** (el `talend-tmap-dataset` del
   `tMap`) no: `exchange.talend.com` no resuelve en DNS desde esta maquina. **Ojo: el `tMap` compila y ejecuta sin
   ese jar** (solo lo necesita el editor visual del mapper), asi que no es un bloqueo.
5. **Tipos de job (Spark Batch, Streaming)**: el MCP ya los crea con la estructura correcta (el `.item` con
   `jobType="Big_Data_Batch" framework="Spark"`, el item de MapReduce en el repositorio y el `FRAMEWORK=Spark` en
   las propiedades; INTERNALS 34), pero **este workspace no los abre**: ni el job de Spark del usuario
   (`prueba_3_Spark`) ni los del MCP ("No se pudo resolver el ProcessItem"). Es un estado del repositorio del
   proyecto, no del MCP. Habria que mirar por que el repositorio no indexa los items de Big Data.
6. Otros, en el roadmap:
   - Postgres de pruebas.
   - Los 120 componentes de la generacion nueva (los `.car`) no tienen XML: su definicion esta en el codigo Java.

## Cuidados

- **El heap de Studio se llena con las mediciones largas** (INTERNALS 39): el codigo generado de cada job se queda
  indexado y, con unas 150 mediciones, el IDE se queda sin memoria y deja de responder (el bridge tampoco). La
  medicion **cancela sola al 80 % del heap** (`scripts/coverage.ts` lo vigila) y hay una tool para verlo:
  `talend_studio_memory` (con `gc: true` fuerza una recoleccion). **Entre sesiones de medicion hay que reiniciar
  Studio**. Si se queda colgado y el proceso sigue vivo: `jcmd <pid> GC.run`.
- **Hay que reiniciar Studio entre mediciones largas**, aunque la medicion no haya llegado al limite: el heap se
  queda lleno de codigo generado y el Studio acaba sin responder. Se vigila con la tool `talend_studio_memory` y
  `scripts/coverage.ts` corta solo al 80 %.
- **Queda por limpiar**: el arnes deja en el workspace de Studio los jobs de prueba `MCP_L5_*` (y `MCP_Coverage`).
  Se borran con `/automation/job/delete`; borrar cierra sus editores. Borrarlos antes de medir, para no llenar el
  workspace y para no confundir un job viejo con uno nuevo.
- Todo lo que hagas por el bridge afecta al Studio real del usuario. Los jobs de prueba `MCP_*` se borran con
  `/automation/job/delete`; borrar cierra sus editores. Si tocas un job que no es tuyo, pregunta.
- `readOnly` en `config.json` solo protege comandos, lanzamientos y `run-code`, **no** las rutas que crean o borran
  jobs y nodos.
- Cada vez que descubras algo de Studio, documentalo en `docs/TALEND-STUDIO-INTERNALS.md`: el usuario lo ha
  pedido repetidamente.
- El usuario escribe en espanol, con mensajes breves; responde en espanol.
