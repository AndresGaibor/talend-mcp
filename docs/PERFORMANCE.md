# Rendimiento del MCP

## Estado y alcance

La latencia depende de la operación. Las tools de lectura local pueden ser rápidas; las de Studio
dependen del estado del IDE y algunas esperan al hilo de interfaz. Ejecutar, compilar o descargar
artefactos no puede tratarse como una operación instantánea.

El servidor conserva el catálogo completo por compatibilidad. Para un cliente MCP orientado al
ciclo habitual de jobs, configura `TALEND_MCP_FILTER=agent`: reduce el catálogo enviado al cliente;
`core` expone un conjunto aún menor. Se puede seguir usando `all` para descubrir todas las
capacidades.

PowerShell:

```powershell
$env:TALEND_MCP_FILTER = "agent"
bun run start:server
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
