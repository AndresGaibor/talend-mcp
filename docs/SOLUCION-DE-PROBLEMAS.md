# Solución de problemas con Studio

Casos que ya ocurrieron y cómo se reconocen. Antes de nada, ejecuta `talend_diagnose_environment`
(o `bun run doctor`): con Studio abierto y el bridge caído, lee el log de Studio y propone el siguiente paso.

## El servidor MCP (puerto 3927) está apagado y Studio sano

Síntoma: `connection refused` en `http://127.0.0.1:3927/mcp` mientras `http://127.0.0.1:3930/ping` contesta.
Es el caso más frecuente desde el cliente `sgm`: el bridge de Studio no falla, lo que murió es el proceso del
servidor MCP.

Solución permanente: el supervisor. `bun run supervisor` mide cada 10 s el MCP (`/healthz`) y el bridge
(`/ping`), relanza el MCP si no responde tres muestras seguidas o si el proceso termina (espera de 1 a 30 s
entre reinicios) y escribe el estado en `logs/supervisor.json`. No reinicia Studio. Para que arranque solo al
iniciar sesión: `bun run scripts/supervisor-install.ts` (`--status` y `--remove` lo consultan y lo quitan;
es una tarea del usuario, sin permisos de administrador).

## Diálogos de Studio que bloquean (lectura y respuesta autónomas)

La pulsación automática está **apagada por defecto**. El plugin tiene su guardián apagado
(`autoDismissModals: false`) y ni el supervisor ni la recuperación del cliente pulsan botones salvo que se
active a propósito con `TALEND_MODALS_AUTO=1`. Antes bastaba con no poner `0`, así que una ventana abierta
por una persona se podía guardar o cerrar sola mientras editaba.

Si se activa, el supervisor (`bun run supervisor`) revisa cada 5 s los diálogos de Studio con accesibilidad
de Windows (UI Automation), sin pasar por el bridge: sigue funcionando con el bridge caído o con la
interfaz atascada. Lee el título, los mensajes (etiquetas y campos de solo lectura) y los botones, decide
con `src/talend/studio/modals/modal-policy.ts` y pulsa. Cada diálogo queda en `logs/modales.jsonl` con su
texto completo, la regla y el resultado.

Si Studio ya se está cerrando solo, ejecuta `talend-mcp repair`: apaga el guardián, quita la tarea
`TalendMcpSupervisor`, actualiza el plugin y borra el jar de carga en caliente anterior. Con Studio cerrado
lo deja todo instalado; con Studio abierto recarga el plugin en marcha y pide cerrarlo para completar p2.

| Tipo | Qué hace |
|---|---|
| El Job ya existe, guardar recursos, esquema del componente destino | Respuesta fija de la regla (Yes, Save, No) |
| Licencias y módulos de terceros | Acepta y descarga (solo con `TALEND_MODALS_AUTO=1`) |
| Error, aviso o información sin regla propia | Registra el mensaje y lo deja abierto: puede ser una ventana que abrió una persona |
| Pregunta sin regla (Yes/No) | Registra y deja abierta |
| Contraseña, campos editables, o que habla de borrar o sobrescribir | No toca: lo decide una persona; queda registrado |

A mano: `bun run modales -- --dry-run` (solo lee y dice qué haría) o `bun run modales` (pulsa).
Reglas nuevas: se añaden a `RULES` en `modal-policy.ts` con su prueba en `tests/talend/modal-policy.test.ts`.

El cliente MCP no cierra ventanas mientras trabaja: durante una escritura solo espera y reintenta si Studio
responde que la interfaz está ocupada. Tampoco pulsa la clasificación genérica de forma automática; para
cerrar un diálogo desconocido hay que pedirlo con `talend_studio_handle_modals`.

El cliente MCP usa la misma lectura cuando el bridge deja de contestar: ante un timeout o un corte de
conexión, `src/talend/studio/recuperacion-de-bridge.ts` lee los diálogos, pulsa solo los conocidos y
**reintenta una vez las lecturas (GET)**. No reintenta escrituras (POST), porque una operación que expiró
pudo aplicarse igual y repetirla duplicaría nodos o contextos; la respuesta lo dice con
`recovery.reintentado: false` y el detalle en `error.message`. Solo se activa con `TALEND_MODALS_AUTO=1`.

## La respuesta es demasiado grande

Dos topes distintos, cada uno con su error:

| Dónde | Variable | Error |
|---|---|---|
| Respuesta del bridge de Studio | `TALEND_BRIDGE_MAX_RESPONSE_BYTES` (64 MiB) | `BRIDGE_RESPONSE_TOO_LARGE`, con `endpoint`, `maxBytes` y `recibidos` |
| Respuesta de una tool en el servidor MCP | `TALEND_MCP_MAX_RESPONSE_BYTES` (64 MiB) | JSON-RPC `RESPONSE_TOO_LARGE`, con `tool` y `maxBytes` |

Antes de subir el tope, pide menos datos: `limit`/`offset` en catálogos, `lines` en logs, filtro por job,
o usa la tool paginada. El bridge lee el cuerpo por trozos y corta al pasar del tope, así que una respuesta
enorme no se materializa entera en memoria. El servidor MCP retiene la salida de `tools/call` hasta saber
su tamaño; si no cabe, descarta el cuerpo y responde el error JSON-RPC en vez de un stream a medias.

## El bridge no responde pero Studio está abierto

El bridge arranca con el workbench, **después del login**. Si `http://127.0.0.1:3930/ping` no contesta y la
ventana de Studio dice "Talend Cloud Data Fabric", Studio sigue en la pantalla de login. No es un fallo del MCP.

`talend_studio_restart` lo distingue: si tras reabrir Studio el bridge no aparece, devuelve
`STUDIO_WAITING_LOGIN` (Studio abierto, esperando el login) o `STUDIO_EXITED` (el proceso desapareció).

## Studio vuelve al login después de "cargando conexión"

Síntomas en `workspace/.metadata/.log`:

- `Refresh token failed.` precedido de `Bad Request` o de `401:Authentication credentials were missing or incorrect.`
- `logged on <proyecto>` justo antes, y de nuevo la pantalla de login.

Causa más probable: el token SSO guardado en `configuration/connection_user.properties` ya no se puede renovar.
Aunque te reautentiques, Studio sigue usando el guardado.

1. Cierra Studio.
2. Copia `configuration/connection_user.properties` a otra carpeta y quita el original de `configuration/`.
3. Abre Studio y crea de nuevo la conexión a Talend Cloud (región y login SSO).

Los proyectos y el git no se tocan. Para deshacerlo, devuelve el archivo copiado.

Si tras esto el refresco sigue fallando, el rechazo viene de la cuenta o del tenant de Talend Cloud: hay que
revisarlo con quien lo administre.

## `ConcurrentModificationException` al iniciar sesión

Aparece en el diálogo de login como `PersistenceException` con `DynaEnum.values` y `FolderHelper.createFolder`
en la traza. Es una carrera interna de Talend: otro hilo modifica la lista de tipos de repositorio mientras el
login la recorre. Studio no la deja en su log.

1. Reintenta el login.
2. Si se repite, abre Studio con `-clean` (reconstruye la caché de OSGi, no toca proyectos).
3. Si sigue, haz copia de `workspace/.metadata/.plugins/org.eclipse.core.resources` y aparta `*.snap` y
   `.root/.markers.snap`. Deja `15.tree` (o el `.tree` que haya): ahí están registrados los proyectos.

## `The workspace exited with unsaved changes in the previous session`

Studio se cerró de golpe (caída o cierre forzado). `talend_studio_restart` cierra con `CloseMainWindow` y solo
termina el proceso pasados 120 s; el resultado indica `forced: true` cuando lo hizo. Cierra Studio con normalidad
siempre que puedas.

## Snapshots en el repositorio del equipo

Los snapshots viven en `<proyecto>/.talend-mcp-snapshots/`. Al crear uno, el MCP añade esa carpeta a
`.git/info/exclude` del repositorio que contiene el proyecto, para que no aparezca como archivo sin versionar.
Es una exclusión local: no cambia el `.gitignore` del equipo.
