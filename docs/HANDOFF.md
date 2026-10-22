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
3. `docs/TALEND-STUDIO-INTERNALS.md`: las secciones 26 a 37 son las nuevas.
4. `docs/PLAN-DE-PRUEBAS.md`: el estado por fase y por familia.
5. `AGENTS.md`: reglas del repo.

## Estado del repo

- Rama `main`, al dia con el remoto. `bun test` verde (304 tests). `bun x tsc --noEmit` pasa.
- Los tests de integracion contra el Studio real solo corren con `TALEND_BRIDGE_INTEGRATION=1`
  (`tests/integration/`). Con y sin Studio, `bun test` es verde.

## Entorno (Windows)

- Bun: `$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"`.
- JDK de Studio: `JAVA_HOME=C:\Talend\8.0.1\zulu21.50.19-ca-jdk21.0.11-win_x64`.
- Studio abierto; el bridge escucha en `127.0.0.1:3930` con token en `~/.talend-bridge/token`.
  `~/.talend-bridge/config.json` tiene `unsafeActions: true`.
- Compilar y recargar el plugin Java en caliente, sin reiniciar Studio (~5 s):
  ```bash
  bun run scripts/start.ts --install-bridge
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

### Conectar bien (un bug que rompia muchos jobs)

El **nombre** de la conexion (`row1`, `row2`...) es la variable de la fila en el codigo generado, y las tablas de
los componentes la referencian (`row1.monto`). El bridge la llamaba `conn_1` y las transformaciones no generaban
codigo. Ademas, el **conector** no siempre es `FLOW`: el `tUniqRow` saca sus filas por `UNIQUE`. Ver INTERNALS 32.

### Arnés de ejecucion (L5)

`scripts/execution-check.ts` monta un job, lo ejecuta y **compara la salida con la esperada** (declarada antes de
ejecutar). Los escenarios estan en `tests/fixtures/talend/escenarios-l5.json`; el informe sale en
`testdata/resultados-l5.csv`. **Cinco escenarios en verde**: el de humo, el de leer un CSV, el de leer y escribir
un CSV, el de transformaciones (`tUniqRow` + `tSortRow` sobre el CSV, quitando el duplicado y ordenando por
importe) y el de orquestacion (un job padre con `tPrejob` + `tRunJob` + `tPostjob` que llama a un job hijo).

Ademas, el de bases de datos: un `tPostgresqlConnection` + `tPostgresqlInput` que lee del Postgres de pruebas
(Docker, `testdata/docker-compose.yml`, puerto 5433). Los tres detalles que hay que recordar estan en INTERNALS 35:
el driver tiene que estar en el `.m2` de Studio con la version exacta, la `QUERY` necesita `literal: true` y la
`CONNECTION` necesita `literal: false`.

Un escenario puede declarar jobs auxiliares (`jobs`): se montan y compilan antes que el principal, que es lo que
hace falta para que un `tRunJob` pueda llamar a su hijo.

### Lo que se ha hecho en esta sesion

- **Los contextos de un job**, de punta a punta, con la API de Studio (crear entorno, poner variable con su valor
  en cada entorno, listar, borrar).
- **Los contextos del proyecto** (los items de tipo Contexts): antes las tools devolvian una lista vacia; ahora
  listan (con sus entornos y variables), leen y borran. Crearlos sigue sin poder (Studio no deja enganchar el
  entorno a un item recien creado) y la tool lo dice y borra lo creado.
- **Las tools de jobs** (`talend_jobs_list`, `talend_jobs_read`, `talend_jobs_create`): leen el proyecto y crean
  con la API de Studio. Antes usaban un repositorio vacio.
- **Los triggers**: era un bug del bridge (el conector de un trigger se llama `OnComponentError`, no
  `COMPONENT_ERROR`), asi que nunca se disparaban. Ahora hay un escenario L5 que lo comprueba.
- **La memoria**: Studio se queda sin memoria con las mediciones largas (INTERNALS 39). Ahora la medicion lo
  vigila y cancela al 80 % del heap, y hay la tool `talend_studio_memory`.
- **12 escenarios L5** con la salida verificada (ver PLAN-DE-PRUEBAS).

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
| L3/L4 | **259 componentes medidos**: las nueve familias mas usadas (134, de los que 99 compilan) y las que no piden artefacto (`Logs_Errors`, `XML`, `Data_Quality`, `File/Management`, `PostgreSQL`, `MySQL`, `Data_Quality/Matching`, `DB_SCD`, `MS_SQL_Server`, `Oracle`): 125 de ellos, 117 compilan. **216 de 259 compilan (83 %)**. Los que no, necesitan una configuracion real (tablas, XSD, columnas), no un jar |
| L5 | **12 escenarios con la salida verificada**: humo, leer un CSV, leer y escribir un CSV, transformaciones con `tUniqRow` y `tSortRow`, **un `tFilterRow` con condicion**, **un `tUnite`**, **un `tMap` que renombra y filtra**, **escribir un JSON**, **un trigger de error**, bases de datos con Postgres, contextos y orquestacion padre/hijo. Quedan 5 pendientes documentados (el `tAggregateRow`, el `tFileInputJSON`, el `tJavaRow`, el `tDBOutput` y el `tFileList`) |

## Lo siguiente (por prioridad)

1. **L5 por familias**: el arnes ya funciona con la familia de archivos, la de transformaciones, la de
   orquestacion y la de bases de datos. Falta la de control de flujo (`tFileList`, triggers de error,
   `tDie`/`tWarn`) y la de escritura en base de datos (`tPostgresqlOutput`, commit/rollback).
2. **El `tAggregateRow`**: necesita dos tablas de metadata (la de entrada y la de salida, las dos en el conector
   `FLOW`) y al rellenar el schema del nodo se rompe la tabla que la conexion de entrada tiene asignada. Habria que
   fusionar el schema con el que ya tiene el nodo en vez de sustituirlo (ver INTERNALS 32).
3. **Medir lo que pide artefacto**: con `--sin-artefacto` la medicion se salta los componentes que piden un jar que
   no esta en el `.m2` de Studio. Los que faltan y se pueden bajar de Maven Central se instalan con
   `talend_studio_install_artifact` (y despues se miden). Los de **Talend Exchange** (el `talend-tmap-dataset` del
   `tMap`) no: `exchange.talend.com` no resuelve en DNS desde esta maquina. **Ojo: el `tMap` compila y ejecuta sin
   ese jar** (solo lo necesita el editor visual del mapper), asi que no es un bloqueo.
4. **Tipos de job (Spark Batch, Streaming)**: el MCP ya los crea con la estructura correcta (el `.item` con
   `jobType="Big_Data_Batch" framework="Spark"`, el item de MapReduce en el repositorio y el `FRAMEWORK=Spark` en
   las propiedades; INTERNALS 34), pero **este workspace no los abre**: ni el job de Spark del usuario
   (`prueba_3_Spark`) ni los del MCP ("No se pudo resolver el ProcessItem"). Es un estado del repositorio del
   proyecto, no del MCP. Habria que mirar por que el repositorio no indexa los items de Big Data.
5. **Metadata del repositorio** (conexiones de base de datos, esquemas de archivo), imprescindible para los `tDB*`.
6. Otros, en el roadmap:
   - Postgres de pruebas.
   - Los 120 componentes de la generacion nueva (los `.car`) no tienen XML: su definicion esta en el codigo Java.

## Cuidados

- **El heap de Studio se llena con las mediciones largas** (INTERNALS 39): el codigo generado de cada job se queda
  indexado y, con unas 150 mediciones, el IDE se queda sin memoria y deja de responder (el bridge tampoco). La
  medicion **cancela sola al 80 % del heap** (`scripts/coverage.ts` lo vigila) y hay una tool para verlo:
  `talend_studio_memory` (con `gc: true` fuerza una recoleccion). **Entre sesiones de medicion hay que reiniciar
  Studio**. Si se queda colgado y el proceso sigue vivo: `jcmd <pid> GC.run`.
- Todo lo que hagas por el bridge afecta al Studio real del usuario. Los jobs de prueba `MCP_*` se borran con
  `/automation/job/delete`; borrar cierra sus editores. Si tocas un job que no es tuyo, pregunta.
- `readOnly` en `config.json` solo protege comandos, lanzamientos y `run-code`, **no** las rutas que crean o borran
  jobs y nodos.
- Cada vez que descubras algo de Studio, documentalo en `docs/TALEND-STUDIO-INTERNALS.md`: el usuario lo ha
  pedido repetidamente.
- El usuario escribe en espanol, con mensajes breves; responde en espanol.
