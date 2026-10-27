# Entorno y flujo canonico

[Volver al indice](../GUIA-AGENTE.md)

## Punto de entrada para un agente nuevo

En una sesion MCP, empieza por `talend_guide { mode: "overview" }`. El servidor tambien entrega
instrucciones durante `initialize`. Para ver una tarea concreta, usa
`talend_guide { mode: "task", task: "crear-job" }`; para buscar por lenguaje natural, usa
`talend_guide { mode: "search", query: "contextos" }`. La guia avisa si el preset activo oculta
alguna tool requerida. Para agentes nuevos, `TALEND_MCP_FILTER=agent` expone las herramientas del
ciclo habitual de un job; `all` expone las capacidades avanzadas.

El catalogo generado de tools, argumentos y requisitos esta en
[CATALOGO-DE-TOOLS.md](../CATALOGO-DE-TOOLS.md). Para aprender el codigo de este repositorio, consulta
[ARQUITECTURA.md](../ARQUITECTURA.md) y [PLAN-DE-TRABAJO.md](../PLAN-DE-TRABAJO.md).

La regla que resume todo: **estrategia mixta.** Para migraciones, lotes y jobs cerrados se trabaja
**offline** (escribiendo el `.item` con `talend_jobs_create_batch`, `talend_job_edit_offline` y
`talend_jobs_edit_batch`, que validan la integridad y son atomicas; ver [MODO-OFFLINE.md](../MODO-OFFLINE.md)).
Para un job **abierto en un editor** y para los componentes que Studio configura al conectarlos (tMap) se usa
la **API de Studio** (via el bridge). Escribir el XML con otra herramienta, o editar en disco un job abierto,
dejo el modelo en memoria obsoleto: aparecieron tipos que no existen (`id_Decimal`), valores corruptos
(`Main1100Main1`) y jobs vacios. Con la API, cada nodo nace con todos sus parametros por defecto y Studio
escribe el archivo.

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
  `talend_job_connect_nodes`, `talend_jobs_create`, `talend_studio_*`, `talend_bridge_*`). **Necesitan Studio
  abierto con el bridge cargado.** Son las que crean y modifican jobs.

`talend_jobs_list` y `talend_jobs_read` leen el proyecto del disco (no hace falta Studio): la lista trae nombre,
version, carpeta, fecha, tamano y numero de componentes de cada job, y la lectura trae los componentes con sus
parametros y las conexiones. `talend_jobs_create` **si** necesita Studio: crea el job con la API del IDE (para crear sin Studio, usa `talend_jobs_create_from_spec` o `talend_jobs_create_batch`); no
escribe el `.item` a mano.

## 2. Antes de empezar: comprobar el entorno

1. Talend Studio abierto, con el proyecto cargado.
2. Servidor MCP arriba: `bun run start:server` (o `bun run start`).
3. Bridge vivo: tool `talend_bridge_ping`, o `bun run scripts/mcp-call.ts talend_bridge_ping '{}'`.
   Debe devolver `plugin: com.andres.talend.bridge`, y `unsafeActions: true` si vas a usar
   `talend_studio_run_code`. **Mira la `version`**: si es anterior a la ultima compilacion del
   plugin, Studio acaba de arrancar y ha cargado el bundle instalado, no el de la carga en
   caliente; reinstala antes de automatizar (INTERNALS 56).
4. Si cambiaste Java del bridge: `bun run bridge:install` (ver
   [AGENTS.md](../../AGENTS.md) para las opciones). No hace falta reiniciar Studio.

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
| 9f | `talend_list_repository_contexts` / `talend_read_repository_context` / `talend_create_repository_context` / `talend_delete_repository_context` | Los contextos **del proyecto** (los items de tipo Contexts): listar, leer, crear, editar variables y borrar. **Atencion:** crear un contexto con una etiqueta existente reemplaza el item actual. |
| 9g | `talend_list_repository_connections` | Lista conexiones compartidas del proyecto con su nombre y tipo. No devuelve rutas, parametros ni credenciales. |
| 9h | `talend_bridge_active_job_dependencies` | Consulta rutinas, modulos requeridos y bibliotecas declaradas por el job activo, incluyendo el estado de instalacion de cada modulo. |
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
