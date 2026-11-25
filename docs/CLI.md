# CLI

`talend-mcp` es también una CLI: ejecuta operaciones del mismo registro de tools sin iniciar un
servidor MCP. Desde el repositorio, `bun run cli <comando>` hace lo mismo.

## Comandos de instalación y servicio

| Comando | Qué hace |
|---|---|
| `talend-mcp setup [--client <lista>] [--project <ruta>] [--dry-run]` | Configura los clientes MCP detectados |
| `talend-mcp remove [--client <lista>]` | Desactiva `talend-mcp` en los clientes (conserva el binario y el historial) |
| `talend-mcp serve` | Servidor MCP por stdio (lo que lanzan los clientes) |
| `talend-mcp version` | Versión instalada |
| `talend-mcp bridge install [--from <zip\|carpeta>] [--dry-run]` | Instala o actualiza el plugin Java en Talend Studio desde el release de la misma versión |
| `talend-mcp bridge uninstall [--dry-run]` | Quita el plugin Java de Talend Studio (Studio cerrado) |

## Operaciones sobre el proyecto

La CLI puede ejecutar un conjunto pequeño de operaciones desde el registro local, sin iniciar el
servidor MCP:

```bash
talend-mcp help
talend-mcp jobs list --project "C:/ruta/al/proyecto" --json
talend-mcp jobs show CARGA_CLIENTES
talend-mcp tools list --json
talend-mcp tools describe talend_jobs_create
talend-mcp tools call talend_guide --input @entrada.json
talend-mcp mcp serve
```

`entrada.json` debe contener `{"mode":"overview"}`. La opción `--input` también acepta JSON directo
o `-` para leerlo desde stdin.

Este MVP clasifica explícitamente solo lectura, listado, inspección y creación básica; las demás
operaciones se bloquean hasta revisar su riesgo. La creación modifica el proyecto, requiere Studio y
confirmación explícita (`--yes` en automatizaciones). Este permiso local no cambia la autorización de
MCP: la unificación de los despachadores CLI, HTTP y stdio queda pendiente. Para consultar el estado
del entorno, sigue disponible `bun run doctor`.
