# Verificacion, dialogos y diagnostico

[Volver al indice](../GUIA-AGENTE.md)

## 5. Verificar el resultado, no el `ok`

Una operacion puede devolver `ok: true` y no haber escrito nada. Despues de escribir:

1. `talend_job_list_nodes` y comparar con lo esperado, y `talend_job_problems` para que no haya avisos.
2. Mirar el `.item`: un job vacio pesa ~196 bytes; si no cambia de tamano tras anadir nodos, no
   llego al disco.
3. Ejecutar con `talend_job_execute` y **comparar la salida contra lo que definiste antes de
   ejecutar**. Es el criterio del [plan de pruebas](../PLAN-DE-PRUEBAS.md).

## 6. Dialogos y bloqueos de Studio

- El bridge trae un **guardian de modales** que cierra solo los dialogos que bloquean el IDE
  (`Jobname Error`, `Save Resource`, avisos nativos de Windows...). Si Studio queda en "No
  responde" por un dialogo, usa `talend_studio_dismiss_dialogs`.
- Para no provocarlos: `talend_job_create_in_studio` con `replace: true` en vez de reusar la
  etiqueta de un job existente.
- Studio puede tardar en responder mientras compila un job; la espera tiene tiempo maximo y
  devuelve error en vez de colgarse. Reintenta.
- Lo que hace el bridge **no debe bloquear el hilo de UI** (ver
  [INTERNALS seccion 26](../TALEND-STUDIO-INTERNALS.md)): ejecutar jobs, descargar artefactos y
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
| `bun run scripts/studio-job.ts <cmd>` | Hablar directo con el bridge: `create`, `add`, `connect`, `schema`, `list`, `run`, `execute`, `delete`, `dialogs` y las fases `fase0`, `fase1`, `fase1b`, `fase2`, `fase3`, `fase4`, `fase5`, `fase6`, `fase9` |
| `bun run scripts/query-bridge.ts` | Volcado del estado de Studio (ping, job activo...) |
| `bun run scripts/coverage.ts` | Mide cuantos componentes del catalogo se crean, se configuran, se montan y compilan (`--filter`, `--family`, `--components`, `--max`, `--compile`, `--out`) |
| `bun run scripts/cobertura-familias.ts` | Cruza los informes de `coverage.ts` con el catalogo instalado: por familia, cuantos compilan, cuantos fallan y cuantos no se han medido (`--todas`, `--familia <texto>`, `--pendientes`) |
| `bun run scripts/execution-check.ts [filtro]` | Monta, ejecuta y verifica los escenarios L5 (el informe sale en `testdata/resultados-l5.csv`) |
| `bun run scripts/component-definitions.ts` | Las definiciones de los componentes instalados (parametros obligatorios, conexiones) y el detalle de uno |
| `bun run scripts/make-testdata.ts [--out <carpeta>]` | Regenera los datos de prueba de `testdata/`; con `--out` escribe en otra carpeta y no borra la local |
| `bun run scripts/limpiar-mcp.ts [--simular]` | Borra los jobs `MCP_*` que dejan el arnes y la medicion (con `--simular` solo los lista), y limpia las carpetas vacias y los proyectos Maven huerfanos |
| `bun run bridge:install` | Compila y recarga el plugin Java en caliente |

## 10. Esperar un job: que significa cada respuesta

Un `ok: true` no dice que el job haya terminado. Mira el estado que devuelve la espera:

| Respuesta | Significado | Que hacer |
|---|---|---|
| `terminated: true` (`status` `success`, `failed` o `terminated_without_exit_code`) | Studio confirma el fin del job | Leer la salida con `talend_job_execute` |
| `WAIT_TIMEOUT` (`status` `started`) | El job sigue en marcha tras el timeout | Volver a esperar con `talend_job_wait_run` |
| `WAIT_UNOBSERVED` (`status` `unobserved`) | El bridge no vigila el launch: se reinicio el plugin o el job duro menos que el sondeo | No esperar mas. Consultar `talend_runs_read` o volver a ejecutar |
| `talend_job_run_by_name` con `timedOut: true` | El job se lanzo, pero sigue en marcha | Leer el `warning` y usar `talend_job_wait_run` con el `launchId` |

En Windows el codigo de salida del lanzamiento no llega por esta via (`terminated_without_exit_code`).
El detalle del mecanismo y sus limites esta en
[INTERNALS 14](../studio-internals/02-operar-el-job.md#14-el-fin-de-la-ejecucion-de-un-job).
