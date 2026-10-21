# Guia del agente: usar el MCP para construir y ejecutar jobs de Talend

Para un agente (o una persona) que **usa** el MCP contra un Talend Studio abierto. Si lo que vas a
hacer es cambiar el codigo del repo, empieza por [AGENTS.md](../AGENTS.md); aqui se explica como
operar Studio.

La regla que resume todo: **los jobs se crean y se modifican con la API de Studio (via el
bridge), nunca escribiendo el `.item` a mano.** Cuando se escribio el XML por fuera, Studio
dejo el modelo en memoria obsoleto, aparecieron tipos que no existen (`id_Decimal`), valores
corruptos (`Main1100Main1`) y jobs vacios. Con la API, cada nodo nace con todos sus parametros
por defecto y Studio escribe el archivo.

## 1. Las piezas y como hablan

```
cliente MCP  --HTTP-->  servidor MCP (Bun)  --HTTP + Bearer-->  bridge (plugin Java)  -->  APIs de Studio
              :3927/mcp                                         127.0.0.1:3930
```

| Pieza | Que es | Donde |
|---|---|---|
| Servidor MCP | ~220 tools `talend_*`. Las de lectura trabajan sobre los `.item` del workspace | `index.ts`, `src/` |
| Bridge | Plugin Java dentro de Studio. Crea y edita jobs con la API nativa, ejecuta, cierra modales | `talend-studio-bridge/` |
| Config del bridge | `~/.talend-bridge/config.json` (`readOnly`, `unsafeActions`, `port`) | maquina local |
| Token del bridge | `~/.talend-bridge/token`; el MCP lo lee solo | maquina local |

Dos familias de tools, con reglas distintas:

- **Lectura y analisis sobre disco** (`talend_jobs_list`, `talend_jobs_read`, `talend_errors_*`,
  `talend_validation_*`, `talend_secrets_*`...). No necesitan Studio abierto.
- **Operar Studio en vivo** (`talend_job_*_in_studio`, `talend_job_add_node`,
  `talend_job_connect_nodes`, `talend_studio_*`, `talend_bridge_*`). **Necesitan Studio abierto
  con el bridge cargado.** Son las que crean y modifican jobs.

## 2. Antes de empezar: comprobar el entorno

1. Talend Studio abierto, con el proyecto cargado.
2. Servidor MCP arriba: `bun run start:server` (o `bun run start`).
3. Bridge vivo: tool `talend_bridge_ping`, o `bun run scripts/mcp-call.ts talend_bridge_ping '{}'`.
   Debe devolver `plugin: com.andres.talend.bridge`, y `unsafeActions: true` si vas a usar
   `talend_studio_run_code`.
4. Si cambiaste Java del bridge: `bun run scripts/start.ts --install-bridge` (ver
   [AGENTS.md](../AGENTS.md) para las opciones). No hace falta reiniciar Studio.

Si el ping no responde, Studio no esta abierto o el plugin no cargo. `talend_bridge_audit_environment`
y el log de Eclipse (`<studio>/workspace/.metadata/.log`) dicen por que.

## 3. Flujo canonico: crear un job, ejecutarlo y comprobar el resultado

Orden obligatorio. Cada paso usa lo que devolvio el anterior (sobre todo los `uniqueName`).

| # | Tool | Para que |
|---|---|---|
| 1 | `talend_studio_list_components` | Saber que componentes hay: 897 de Standard (`paletteType` por defecto `DI`); las 397 variantes de Spark/Streaming solo valen en jobs de ese tipo |
| 1b | `talend_components_definition` | Que exige cada componente: parametros obligatorios con su valor, conexiones, artefactos. Se lee del XML de la instalacion de Studio, **sin abrir Studio** |
| 2 | `talend_studio_component_parameters` | Ver los parametros reales de un componente (tipo, defecto, columnas de sus tablas). **No adivines**: preguntalo |
| 3 | `talend_job_delete_in_studio` | Si el job ya existe y quieres partir de cero |
| 4 | `talend_job_create_in_studio` | Crea el job vacio (`replace: true` lo reemplaza). Lo deja abierto en el editor |
| 5 | `talend_job_add_node` | Anade un componente. Devuelve su `uniqueName` (`tFileInputDelimited_1`). Admite `parameters`, `tables`, `schema`, `mapper` |
| 6 | `talend_job_set_schema` | Columnas del nodo. En `tFixedFlowInput`, ademas `values` con las filas |
| 7 | `talend_job_connect_nodes` | Conecta por `uniqueName` (`FLOW` por defecto; tambien `REJECT`, triggers...) |
| 8 | `talend_job_configure_node` / `talend_job_update_node` | Retocar parametros, tablas, schema o tMap de un nodo existente |
| 9 | `talend_job_list_nodes` | Comprobar lo que hay en el job |
| 9b | `talend_job_problems` | Errores y avisos de diseno (los de la vista Problemas) sin ejecutar nada. `clean: true` = abre sin avisos. Ejemplos: "No schema has been defined yet", "This component should have input link(s)" |
| 9c | `talend_job_compile` | Genera el codigo y comprueba que **compila**, sin ejecutar. Devuelve `compiles` y, si falla, `error.line` y `error.message` (p. ej. `no_comillas cannot be resolved to a variable`). ~2 s; ocupa la UI mientras genera, igual que un Run |
| 9d | `talend_job_contexts_list` | Los contextos (entornos) del job y sus variables, con el valor de cada variable en cada entorno |
| 9e | `talend_job_context_create` / `talend_job_context_set` / `talend_job_context_delete` / `talend_job_context_delete_variable` | Crear un entorno, poner o cambiar una variable (con su valor en ese entorno), y borrarlos. Todo con la API de Studio, y el job se guarda |
| 10 | `talend_job_run_by_name` | Genera el codigo, compila y lanza el job en Studio. **No devuelve la salida** (va a la vista Run) |
| 11 | `talend_job_execute` | Relanza el job ya compilado y **devuelve `exitCode` y la salida** (`stdout`, `lines`). Es como se comprueba el resultado |
Ejemplo minimo (humo): `tFixedFlowInput` -> `tLogRow`.

```
talend_job_create_in_studio  { "name": "MCP_Humo", "replace": true }
talend_job_add_node          { "type": "tFixedFlowInput" }          -> tFixedFlowInput_1
talend_job_add_node          { "type": "tLogRow" }                  -> tLogRow_1
talend_job_set_schema        { "uniqueName": "tFixedFlowInput_1",
                               "columns": [ {"name":"id","type":"id_Integer"},
                                            {"name":"ciudad","type":"id_String"} ],
                               "values": [["1","Bogota"],["2","Medellin"]] }
talend_job_connect_nodes     { "source": "tFixedFlowInput_1", "target": "tLogRow_1" }
talend_job_run_by_name       { "jobName": "MCP_Humo" }
talend_job_execute           { "name": "MCP_Humo" }                  -> lines: ["1|Bogota","2|Medellin"]
```

Lo mismo en una sola linea de comandos: `bun run scripts/studio-job.ts fase0`.

**Editar un job que ya existe:** `talend_job_open_in_studio` -> `talend_job_list_nodes` ->
`talend_job_update_node` / `talend_job_configure_node`. No lo recrees.

## 4. Reglas de configuracion que hacen fallar jobs (leerlas antes de configurar)

- **Los valores de texto son literales Java.** Una ruta va entre comillas (`"C:/datos/a.csv"`) o el
  codigo generado no compila. El bridge entrecomilla solo lo que no es numero, booleano ni ya
  viene entre comillas; usa `literal: true` en el parametro para forzarlo.
- **`HEADER` de `tFileInputDelimited` es un numero** (lineas de cabecera, `"1"`), no un booleano.
- **Tipos de columna validos:** `id_String`, `id_Integer`, `id_Long`, `id_Double`, `id_BigDecimal`,
  `id_Boolean`, `id_Date` (y alias que normaliza el bridge). `id_Decimal` **no existe**: es
  `id_BigDecimal`.
- **Sin schema no hay columnas.** Un nodo sin schema no propaga columnas y el codigo generado sale
  mal (`... cannot be resolved to a variable`). Define el schema del origen antes de conectar.
- **`tLogRow` hereda el schema** del componente que le manda el flujo; no se lo pongas a mano.
- **`tMap`:** el nombre de cada tabla del modelo es el de **su conexion**, y el modelo se aplica
  **al final** (despues de crear y conectar), porque al conectar Talend rehace sus tablas.
- **Conexiones:** el tipo de conexion es el **conector** del componente (`FLOW`, `UNIQUE`, `REJECT`,
  `ITERATE`...), no un texto libre: el `tUniqRow` saca sus filas por `UNIQUE`, y conectar por `FLOW`
  compila pero no sale ninguna fila. `talend_job_connect_nodes` lo comprueba antes de conectar y avisa
  del conector que toca. El **nombre** de la conexion lo pone el bridge (`row1`, `row2`...), y es el que
  usan las tablas de los componentes (`row1.monto`). Ver INTERNALS 32.
- **Parametros que el catalogo no declara** (p. ej. `FILENAME` de `tFileOutputDelimited`): el bridge
  los crea con el tipo indicado o deducido.
- Detalle y justificacion en [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md) seccion 18.

## 5. Verificar el resultado, no el `ok`

Una operacion puede devolver `ok: true` y no haber escrito nada. Despues de escribir:

1. `talend_job_list_nodes` y comparar con lo esperado, y `talend_job_problems` para que no haya avisos.
2. Mirar el `.item`: un job vacio pesa ~196 bytes; si no cambia de tamano tras anadir nodos, no
   llego al disco.
3. Ejecutar con `talend_job_execute` y **comparar la salida contra lo que definiste antes de
   ejecutar**. Es el criterio del [plan de pruebas](PLAN-DE-PRUEBAS.md).

## 6. Dialogos y bloqueos de Studio

- El bridge trae un **guardian de modales** que cierra solo los dialogos que bloquean el IDE
  (`Jobname Error`, `Save Resource`, avisos nativos de Windows...). Si Studio queda en "No
  responde" por un dialogo, usa `talend_studio_dismiss_dialogs`.
- Para no provocarlos: `talend_job_create_in_studio` con `replace: true` en vez de reusar la
  etiqueta de un job existente.
- Studio puede tardar en responder mientras compila un job; la espera tiene tiempo maximo y
  devuelve error en vez de colgarse. Reintenta.
- Lo que hace el bridge **no debe bloquear el hilo de UI** (ver
  [INTERNALS seccion 26](TALEND-STUDIO-INTERNALS.md)): ejecutar jobs, descargar artefactos y
  recorrer el catalogo corren fuera de la UI.

## 7. Cuando el MCP no tiene una tool: `talend_studio_run_code`

Compila y ejecuta Java **dentro de Studio**, con acceso a todas sus APIs. Requiere
`unsafeActions: true` en `~/.talend-bridge/config.json`. El codigo debe tener una clase con
`public static Object run()`.

Es la forma rapida de explorar y probar una API interna **sin recompilar el bridge** (que es lo
lento). Flujo recomendado: probar con `run_code`, y cuando funcione, llevarlo al bridge como
operacion con su tool y su documentacion. No dejes logica solo en un `run_code`: quien clone el
repo no la tendra.

## 8. API directa del bridge (sin pasar por el MCP)

Un agente puede hablar con Studio sin el servidor MCP, por dos niveles:

1. **HTTP del bridge**: `http://127.0.0.1:3930`, cabecera `Authorization: Bearer <token>` (el token
   esta en `~/.talend-bridge/token`; `/ping` es la unica ruta sin token). Cada ruta acepta
   `GET` o `POST` con cuerpo JSON. Atajo: `scripts/bridge-call.ts`.

   ```bash
   bun run scripts/bridge-call.ts /ping
   bun run scripts/bridge-call.ts /automation/components '{"filter":"tFile","limit":5}'
   bun run scripts/bridge-call.ts /automation/nodes/add '{"type":"tLogRow","job":"MCP_Humo"}'
   ```

   En **PowerShell** las comillas dobles del JSON en linea se pierden y falla con "Cuerpo
   invalido": guarda el JSON en un archivo y pasa `@cuerpo.json`.

   La respuesta usa el sobre del bridge: `ok`, `source`, `endpoint`, `result` (o `error`).
   Cada tool `talend_job_*` / `talend_studio_*` es un envoltorio de una de estas rutas, con el
   mismo cuerpo.

2. **API Java de Studio**: `POST /automation/run-code` (tool `talend_studio_run_code`) compila y
   ejecuta Java dentro de Studio, con acceso a cualquier clase de Talend y Eclipse. Es la salida
   para lo que ninguna ruta cubre. Requiere `unsafeActions: true`.

| Grupo | Rutas |
|---|---|
| Estado | `/ping`, `/capabilities`, `/audit/environment`, `/workspace/state`, `/workspace/refresh`, `/problems/markers`, `/events/recent`, `/events/clear` |
| Jobs | `/automation/job/create`, `/automation/job/open`, `/automation/job/delete`, `/automation/job/execute` |
| Nodos | `/automation/nodes/add`, `/connect`, `/update`, `/configure`, `/schema`, `/copy`, `/delete`, `/list` (todas bajo `/automation/nodes/`) |
| Catalogo | `/automation/components`, `/automation/components/parameters`, `/automation/coverage` |
| Ejecucion | `/automation/run-active-job`, `/launch/configs`, `/launch/run`, `/launch/runs`, `/launch/run-status`, `/launch/wait` |
| Utilidades | `/automation/run-code`, `/automation/artifacts/install`, `/workbench/dialogs`, `/workbench/modules/install` |
| Editor e IDE | `/workbench/state`, `/selection`, `/views`, `/open-resource`, `/save-active`, `/save-all`, `/close-editor`, `/activate-editor`, `/find-editor`, `/show-view` (bajo `/workbench/`), `/commands/list`, `/commands/execute` |
| Introspeccion | `/talend/active-job/model`, `/talend/active-job/details`, `/talend/active-job/select-component`, `/talend/active-component/details`, `/talend/active-editor/introspect`, `/talend/probe/classes` |

`readOnly` de `~/.talend-bridge/config.json` bloquea solo los comandos del IDE, los lanzamientos
(`/launch/run`, `/automation/run-active-job`) y `/automation/run-code`. **No protege** las rutas que
crean, editan o borran jobs y nodos (`/automation/job/*`, `/automation/nodes/*`): cualquiera con el
token puede modificar el proyecto. Los comandos del IDE solo corren si estan en `allowCommands`.

> **Talend Cloud (TMC) es otra API distinta.** Esta guia cubre Talend Studio. Las API REST de
> Talend Management Console (tareas, planes, engines) no estan conectadas a este repo.

## 9. Scripts de linea de comandos

| Script | Para que |
|---|---|
| `bun run scripts/mcp-call.ts <tool> '<json>'` | Llamar cualquier tool del MCP sin cliente MCP |
| `bun run scripts/bridge-call.ts /ruta '<json>'` | Llamar directo a la API HTTP del bridge, sin MCP (seccion 8) |
| `bun run scripts/studio-job.ts <cmd>` | Hablar directo con el bridge: `fase0`, `create`, `add`, `connect`, `schema`, `list`, `run`, `delete`, `dialogs` |
| `bun run scripts/query-bridge.ts` | Volcado del estado de Studio (ping, job activo...) |
| `bun run scripts/coverage.ts` | Mide cuantos componentes del catalogo se crean, se configuran, se montan y compilan (`--filter`, `--family`, `--components`, `--max`, `--compile`, `--out`) |
| `bun run scripts/component-definitions.ts` | Las definiciones de los componentes instalados (parametros obligatorios, conexiones) y el detalle de uno |
| `bun run scripts/make-testdata.ts` | Regenera los datos de prueba de `testdata/` |
| `bun run scripts/start.ts --install-bridge` | Compila y recarga el plugin Java en caliente |

## 10. Errores frecuentes

| Sintoma | Causa | Que hacer |
|---|---|---|
| `Unknown java id type : 'id_Decimal'` | Tipo inexistente | Usa `id_BigDecimal` |
| `X cannot be resolved to a variable` (compilacion) | Valor de texto sin comillas o schema sin definir | Valores como literal Java; define el schema |
| `NumberFormatException: "Main1100Main1"` | Nodo creado fuera de la API de Studio | Recrear el nodo con `talend_job_add_node` |
| Job vacio tras anadir nodos | No se guardo (`doSave` aborta si el editor no esta "dirty") | Operar con las tools `talend_job_*`, que guardan por `saveXmlFile` |
| `Invalid class loader from a refreshed bundle` | Bridge viejo atendiendo tras recargar | Volver a ejecutar `--install-bridge` |
| `The Job ... has wrong configuration` | Error de compilacion del job | Leer `Error Line` y `Detail Message` |
| `Missing artifact ...` | Runtime del componente no incluido en Studio | `talend_studio_install_artifact` (Maven Central) |
| `talend-tmap-dataset-...jar` ausente | El tMap necesita un modulo de Talend Exchange | Limitacion del entorno, ver abajo |
| `El hilo de la interfaz de Studio esta ocupado` | La UI esta compilando u ocupada | Esperar y reintentar |

## 11. Limites conocidos (no es culpa del diseno)

| Tema | Estado |
|---|---|
| `tMap` | El `.item` sale correcto (expresiones, filtros, joins) pero **no compila** sin `talend-tmap-dataset-1.2.16.jar`, de Talend Exchange (no esta en Maven Central) |
| `tFilterRow`, `tSortRow`, `tUniqRow`, `tAggregateRow` | Se configuran con el plan de la definicion (sus tablas se rellenan con las columnas del schema) y **compilan**; falta probarlos con filas y condiciones reales |
| `tFileInputPositional`, `tFileInputJSON` | Generan codigo que no compila en 8.0.1 (usan `onSubJobError` inexistente). Usa `tFileInputDelimited` si puedes |
| `tFileOutputARFF`, `tFileInputARFF`, `tFileInputXML` | El componente esta escrito para otra version de Weka que la que trae Studio |
| `tFileOutputDelimited` | Necesita librerias que pueden faltar en el `.m2` de Studio |
| Cobertura del catalogo | Medida sobre los 897 componentes Standard: 877 (98 %) se crean, configuran, guardan y borran (L1/L2). Con el montaje (L3) y los parametros obligatorios del XML, la mayoria compila (L4). Las 397 variantes de Spark/Streaming necesitan un job de ese tipo (no soportado). Ejecutar con la salida esperada (L5) solo medido en muestras |
| Componentes de la generacion nueva | Los 120 de los `.car` (AWS, JDBC, Snowflake...) no tienen XML: su definicion esta en el codigo Java y hay que preguntarsela a Studio (`talend_studio_component_parameters`) |
| Salida de la vista Run | No se puede leer; por eso existe `talend_job_execute` |

Estado fase por fase en [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md).

## 12. Documentacion relacionada

- [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md): fases, criterios y estado.
- [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md): que falta para automatizar Talend al 100 %.
- [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md): APIs internas de Studio, recetas y trampas.
- [ARQUITECTURA.md](ARQUITECTURA.md): capas del repo y del plugin.
- [PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md): recetas para cambiar el repo.
