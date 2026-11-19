# Configuración

Referencia de las variables de entorno del servidor y de dos capacidades de ejecución: reintentos
idempotentes y ejecuciones asíncronas. Se declaran en el bloque `env` del cliente MCP, en
`.env.local` (desde el repositorio) o en el entorno del proceso.

Por defecto el servidor usa HTTP local. Estas variables ajustan el modo, el puerto o las herramientas
visibles:

| Variable | Uso |
|---|---|
| `TALEND_PROJECT` | Carpeta del proyecto (la que contiene `talend.project`). |
| `TALEND_WORKSPACE` | Ubicación del workspace, si no defines `TALEND_PROJECT`. |
| `TALEND_MCP_MODE` | `http` o `stdio`. |
| `TALEND_MCP_PORT` | Puerto HTTP (por defecto `3927`). |
| `TALEND_MCP_HOST` | Dirección de escucha (por defecto `127.0.0.1`). |
| `TALEND_MCP_TOKEN` | Token Bearer obligatorio al escuchar fuera de loopback; protege las rutas MCP y `/metrics`. `/healthz` y CORS preflight siguen públicos. |
| `TALEND_MCP_FILTER` | Herramientas visibles: `agent` (por defecto en `start`), `core`, `canonical` o `all`. |
| `TALEND_MCP_MAX_BODY_BYTES` | Tope del cuerpo JSON-RPC (por defecto `1048576`). Al superarlo se responde 413. |
| `TALEND_MCP_MAX_RUNS` | Ejecuciones que se conservan en el historial (por defecto `200`); las mas viejas se borran con sus archivos. |
| `TALEND_MCP_RUNS_DIR` | Carpeta del historial de ejecuciones (por defecto `.talend-mcp/runs`). |
| `TALEND_MCP_TOOL_TIMEOUT_MS` | Plazo de una llamada a una tool (por defecto `600000`). Al vencer responde que no termino. |
| `TALEND_MCP_MAX_CONCURRENT_CALLS` | Llamadas a tools atendidas a la vez (por defecto `4`); el resto recibe servidor ocupado. |
| `TALEND_MCP_MAX_RESPONSE_BYTES` | Tope de una respuesta de tool (por defecto `67108864`, 64 MiB); por encima responde un error JSON-RPC `RESPONSE_TOO_LARGE` que pide paginar o subir el tope. |
| `TALEND_MCP_IDEMPOTENCY_DIR` | Carpeta local para el registro de reintentos idempotentes (por defecto `.talend-mcp`). Protege su contenido: puede incluir resultados devueltos por tools. |
| `TALEND_BRIDGE_MAX_RESPONSE_BYTES` | Tope de una respuesta del bridge (por defecto `67108864`, 64 MiB). Si se supera, la tool devuelve `BRIDGE_RESPONSE_TOO_LARGE` con `endpoint`, `maxBytes` y `recibidos`; valores inválidos caen al default. |
| `TALEND_MODALS_AUTO` | `0` apaga la recuperación automática de diálogos de Studio: ante un timeout del bridge el cliente no lee ni pulsa modales ni reintenta. Activa por defecto en Windows. |
| `TALEND_STUDIO_HOME` | Instalación de Studio (carpeta con `plugins/` y `features/`). |
| `TALEND_BRIDGE_AUTO_INSTALL` | `0` desactiva la actualización automática del plugin al arrancar. |
| `TALEND_MCP_LOG` | `quiet`, `normal` o `verbose` para los mensajes de los CLI. |
| `TALEND_LOG_DIR` | Carpeta donde buscar los logs de Studio para `talend_read_run_log`. |
| `TALEND_DISABLE_AUTODETECT` | `1` impide inferir el proyecto desde el workspace. |

## Reintentos idempotentes por HTTP

Para evitar duplicar una escritura cuando no se recibió su respuesta, un cliente HTTP MCP puede
enviar `Idempotency-Key: <clave>` en la petición JSON-RPC `tools/call`. La clave debe tener entre
8 y 200 caracteres. Una repetición con la misma clave y el mismo nombre/argumentos devuelve el
resultado previo; si cambia la solicitud, se rechaza. Si el proceso interrumpió la operación y no
pudo confirmar el resultado, esa clave queda bloqueada como incierta para evitar repetir efectos.

El registro guarda hasta 500 entradas durante siete días en `.talend-mcp/idempotency.sqlite`;
trátalo como dato local sensible y no lo compartas. El archivo JSON previo se importa al abrir la
base SQLite. La capacidad aplica a HTTP (`Idempotency-Key`), CLI (`tools call ... --idempotency-key
<clave>`) y metadata MCP (`_meta.idempotencyKey`). SQLite coordina procesos locales que comparten
el mismo directorio; no coordina servidores en hosts distintos ni debe colocarse en un filesystem
de red sin garantías de bloqueo SQLite.

## Ejecuciones asíncronas

`talend_runs_start_async` inicia un Job confirmado (`confirm: true`) y devuelve un `operationId`;
`talend_operations_status` consulta su estado y `talend_operations_cancel` solicita cancelar cuando el backend lo permite.
Los builds batch asíncronos comparten su `operationId` con el bridge: estado y cancelación se pueden recuperar tras reiniciar el servidor MCP mientras Studio conserve el historial (hasta 24 horas).
El estado vive en memoria del servidor, con un máximo de cuatro ejecuciones activas. Si el servidor
se reinicia, los identificadores anteriores dejan de estar disponibles.
