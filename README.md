# talend-mcp

Servidor MCP local en modo solo lectura para analizar proyectos de Qlik Talend Studio.

Sirve para inspeccionar jobs, componentes, contextos, flujos y logs sin modificar el workspace ni ejecutar procesos.

## Requisitos

- Bun instalado
- Talend Studio con un workspace accesible desde esta maquina
- Una ruta valida del proyecto Talend

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

La variable mas importante es `TALEND_PROJECT`.

Ejemplo:

```bash
export TALEND_PROJECT="/ruta/a/tu/proyecto-talend"
```

Opciones disponibles:

- `TALEND_MCP_MODE` - `stdio` (por defecto) o `http`
- `TALEND_MCP_PORT` - puerto del servidor HTTP, por defecto `3927`
- `TALEND_MCP_HOST` - host del servidor HTTP, por defecto `127.0.0.1`
- `TALEND_MCP_FUNNEL` - desactiva el tunnel publico con `false`
- `TALEND_MCP_LIVE` - desactiva el modo live con `false`
- `TALEND_PROJECT` - ruta absoluta al proyecto Talend

## Integracion MCP

Ejemplo de configuracion para un cliente MCP:

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "/ruta/al/repositorio/talend-mcp/index.ts"],
      "env": {
        "TALEND_PROJECT": "/ruta/a/tu/proyecto-talend"
      }
    }
  }
}
```

Si usas HTTP, inicia el servidor con `TALEND_MCP_MODE=http` y conecta el cliente a la URL `/mcp`.

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
2. Define `TALEND_PROJECT` con la ruta real de tu proyecto
3. Ejecuta `bun run start`
4. Conecta tu cliente MCP a este servidor

## Solucion de problemas

- Si no detecta el proyecto, revisa que `TALEND_PROJECT` apunte a una ruta existente
- Si el job abierto no aparece, asegurate de tener Talend Studio abierto con un editor activo
- Si ejecutas por HTTP y no responde, revisa `TALEND_MCP_PORT` y `TALEND_MCP_HOST`
