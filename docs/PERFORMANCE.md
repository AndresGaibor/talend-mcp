# Rendimiento del MCP

## Estado y alcance

La latencia depende de la operación. Las tools de lectura local pueden ser rápidas; las de Studio
dependen del estado del IDE y algunas esperan al hilo de interfaz. Ejecutar, compilar o descargar
artefactos no puede tratarse como una operación instantánea.

El servidor conserva el catálogo completo por compatibilidad. `bun run start` expone por defecto el
preset `agent`, que es el que conviene a un cliente orientado al ciclo habitual de jobs. `core`
expone un conjunto aún menor y `canonical`/`all` sirven para descubrir todas las capacidades.

Medición del 26 de octubre de 2026, con Bun 1.4.3 en Windows:

| Preset | Tools | `tools/list` | Arranque hasta `/healthz` |
|---|---:|---:|---:|
| `all` | 231 | 373 KB | 0,38 s |
| `canonical` | 230 | 371 KB | 0,34 s |
| `agent` (por defecto) | 46 | 90 KB | 0,31 s |

Desde que el `McpServer` y el transporte SSE se crean solo si un cliente pide
`text/event-stream`, arrancar no registra las 230 tools: `initialize`, `tools/list` y `tools/call`
responden sobre un catálogo ya serializado. `tools/list` tarda 2–3 ms.

La diferencia de payload es el motivo del cambio de valor por defecto: 90 KB frente a 371 KB en
cada handshake inicial. Para el catálogo completo:

```powershell
$env:TALEND_MCP_FILTER = "canonical"
bun run start
```

## Medición repetible

`bun run benchmark:performance` mide importación, arranque del servidor y ocho solicitudes
`tools/list`. No ejecuta tools con efectos ni necesita Studio. Los resultados son específicos
del equipo y deben compararse con la misma versión de Bun y el mismo preset.

```powershell
bun run benchmark:performance
$env:TALEND_MCP_FILTER = "agent"
bun run benchmark:performance
```

El benchmark reporta mediana y p95 de `tools/list`, cantidad de tools y bytes de respuesta. Para
medir una operación real de Studio, registra por separado el tiempo del MCP y del endpoint bridge;
no compares una tool de filesystem con compilación o ejecución.

## Tiempo de la suite

| Comando | Qué mide | Referencia en este equipo |
|---|---|---|
| `bun test` | 371 tests en 69 archivos | ~1,6 s |
| `bun run typecheck` | `tsc --noEmit` completo | ~4-5 s |
| `bun run verify` | typecheck + tests + fixtures L5 | ~7 s |
| `bun run doctor` | Studio, bridge, MCP y configuración | ~0,2 s |
| `bun run l5:validar` | 79 fixtures de 14 suites, sin Studio | ~65 ms |

Los escenarios L5 viven en `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`: un
archivo por escenario dentro de la carpeta de su suite (79 archivos, el mayor de 7 KB). Así cada
escenario se revisa y se compara contra git por separado, y `--suite` lee solo esa carpeta. Cargar
el catálogo completo cuesta ~12 ms; validarlo, ~15 ms. `bun run l5:validar` lo comprueba sin abrir
Studio y sin cargar el bridge ni el índice de componentes, por eso responde en decenas de
milisegundos.

## Arranque del plugin

`bun run start` solo toca el plugin cuando hace falta: el bridge no responde y Talend Studio está
abierto. En ese caso compila con `javac` y publica el jar para carga en caliente, sin Maven y sin
reiniciar Studio. Si Studio está cerrado, no instala nada (p2 requiere Studio detenido y es lento).
Se desactiva con `TALEND_BRIDGE_AUTO_INSTALL=0` o `bun run start --skip-bridge`.

`bun run bridge:install` sigue siendo el comando explícito para instalar o actualizar el plugin
completo. Si las fuentes no cambiaron y el bridge ya sirve esa versión, termina sin recompilar.

## Optimizaciones aplicadas

- El recorrido recursivo lista hasta 32 directorios concurrentemente y conserva resultados
  ordenados.
- Las lecturas de `.properties`, `.item` y archivos XMI se hacen en lotes limitados.
- Las búsquedas de un job leen los metadatos del proyecto, pero parsean el `.item` solo del
  resultado encontrado.
- La detección de proyecto por workspace se cachea por cinco segundos; las detecciones fallidas
  del bridge se agrupan y se suprimen durante tres segundos para evitar esperar repetidamente el
  timeout.
- El cliente predeterminado del bridge se comparte durante cinco segundos y sus lecturas iniciales
  de configuración y token ocurren en paralelo. La expiración permite recoger rotaciones de token
  y cambios de configuración sin reiniciar el MCP.
- Los resultados textuales JSON se serializan de forma compacta; `structuredContent` conserva el
  payload estructurado.

## Tuning y límites

- Mantén explícito `TALEND_PROJECT` cuando sea posible; evita escanear el workspace para inferirlo.
- Usa `agent` o `core` si no necesitas el catálogo completo.
- Para construir jobs con Studio, agrupa parámetros/schema en la llamada de `talend_job_add_node`
  cuando sea apropiado, en vez de enviar llamadas separadas solo para configurar el nodo.
- No aumentes la concurrencia de operaciones de escritura al bridge sin validar la seguridad del
  modelo de Studio: esas acciones interactúan con un IDE y con su hilo UI.
- Los timeouts del bridge son límites de espera, no metas de rendimiento. Una UI ocupada puede
  tardar mucho más que una lectura local.
