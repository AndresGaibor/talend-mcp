# talend-mcp

Servidor MCP local read-only para analizar proyectos de Qlik Talend Studio.

## Install dependencies

```bash
bun install
```

## Run

```bash
bun run index.ts
```

## MCP configuration

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "/Users/andresgaibor/code/javascript/talend-mcp/index.ts"],
      "env": {
        "TALEND_PROJECT": "/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB"
      }
    }
  }
}
```

El servidor no modifica `.item`, `.properties`, `.metadata` ni ejecuta jobs.

## Tools

- `talend_detect_open_job` — detecta el job abierto en Talend Studio
- `talend_list_jobs` — lista todos los jobs del proyecto
- `talend_read_job` — resumen de un job
- `talend_list_components` — componentes del job
- `talend_show_flow` — flujo entre componentes
- `talend_read_contexts` — variables de contexto
- `talend_analyze_tdboutput` — análisis de tMysqlOutput/tDBOutput
- `talend_read_latest_run_log` — última ejecución (success/error/unknown)
- `talend_read_job_errors` — errores históricos en .metadata/.log
- `talend_summarize_open_job` — resumen completo del job abierto
