# talend-mcp

Servidor MCP local en modo solo lectura para analizar proyectos de Qlik Talend Studio.

Sirve para inspeccionar jobs, componentes, contextos, flujos y logs sin modificar el workspace ni ejecutar procesos.

## Requisitos

- Bun instalado
- Talend Studio con un workspace accesible desde esta maquina
- Un workspace de Talend accesible localmente

## Instalacion

```bash
bun install
```

## Ejecucion

Modo por defecto: `stdio`

```bash
bun run start
```

Si quieres levantarlo por HTTP:

```bash
TALEND_MCP_MODE=http bun run start
```

## Configuracion

La deteccion automatica usa `TALEND_WORKSPACE` para encontrar el proyecto abierto.

Ejemplo:

```bash
export TALEND_WORKSPACE="<ruta-al-workspace-de-talend>"
```

Opciones disponibles:

- `TALEND_MCP_MODE` - `stdio` (por defecto) o `http`
- `TALEND_MCP_PORT` - puerto del servidor HTTP, por defecto `3927`
- `TALEND_MCP_HOST` - host del servidor HTTP, por defecto `127.0.0.1`
- `TALEND_MCP_FUNNEL` - desactiva el tunnel publico con `false`
- `TALEND_MCP_LIVE` - desactiva el modo live con `false`
- `TALEND_WORKSPACE` - ruta al workspace de Talend donde esta el proyecto abierto
- `TALEND_PROJECT` - ruta al proyecto Talend, solo si quieres forzar uno en particular

## Integracion MCP

Ejemplo de configuracion para un cliente MCP:

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "index.ts"],
      "env": {
        "TALEND_WORKSPACE": "<ruta-al-workspace-de-talend>"
      }
    }
  }
}
```

Si usas HTTP, inicia el servidor con `TALEND_MCP_MODE=http` y conecta el cliente a la URL `/mcp`.

El servidor detecta automaticamente el proyecto abierto a partir del workspace y sus archivos `.metadata`, sin usar una ruta fija al proyecto.

## Que hace

El servidor es de solo lectura.

- No modifica `.item`, `.properties`, `.metadata` ni `.launch`
- No ejecuta jobs
- No escribe archivos
- No toca la UI de Talend Studio

## Herramientas disponibles

- `talend_detect_open_job` - detecta el job abierto en Talend Studio
- `talend_list_jobs` - lista los jobs del proyecto
- `talend_read_job` - devuelve un resumen de un job
- `talend_list_components` - lista los componentes del job
- `talend_show_flow` - muestra el flujo entre componentes
- `talend_read_contexts` - lee variables de contexto
- `talend_analyze_tdboutput` - analiza salidas a base de datos
- `talend_read_latest_run_log` - obtiene la ultima ejecucion y su estado
- `talend_read_job_errors` - resume errores historicos en `.metadata` y `.log`
- `talend_summarize_open_job` - genera un resumen completo del job abierto

## Ejemplo rapido

1. Instala dependencias con `bun install`
2. Define `TALEND_WORKSPACE` con la ruta de tu workspace de Talend
3. Ejecuta `bun run start`
4. Conecta tu cliente MCP a este servidor

## Solucion de problemas

- Si no detecta el proyecto, revisa que `TALEND_WORKSPACE` apunte a una ruta existente
- Si el job abierto no aparece, asegurate de tener Talend Studio abierto con un editor activo
- Si ejecutas por HTTP y no responde, revisa `TALEND_MCP_PORT` y `TALEND_MCP_HOST`
