# talend-mcp

Servidor MCP para analizar y editar proyectos de Qlik Talend Studio.

Sirve para inspeccionar jobs, componentes, contextos, flujos, logs y ejecutar modificaciones
sobre archivos `.item` y `.properties` de Talend.

## Requisitos

- [Bun](https://bun.sh) instalado
- Talend Studio con un workspace accesible desde esta maquina

## Instalacion

```bash
git clone <repo-url> talend-mcp
cd talend-mcp
bun install
```

## Ejecucion

```bash
bun run start
```

Este comando hace todo automaticamente:

1. **Detecta tu SO** (macOS, Windows o Linux/WSL)
2. **Descarga tunnel-client** si no esta instalado
3. **Pide `CONTROL_PLANE_API_KEY`** si no la encuentra y la persiste en `.env.local`
4. **Pide Tunnel ID** (solo la primera vez) e inicializa el perfil
5. **Inicia el servidor MCP** en `http://127.0.0.1:3927`
6. **Inicia el tunnel** hacia OpenAI

Si quieres solo el servidor sin tunnel: `bun run start:server`

## Variables de entorno

| Variable | Default | Descripcion |
|---|---|---|
| `TALEND_MCP_MODE` | `http` | `http` o `stdio` |
| `TALEND_MCP_PORT` | `3927` | Puerto del servidor HTTP |
| `TALEND_MCP_HOST` | `127.0.0.1` | Host del servidor HTTP |
| `TALEND_MCP_LIVE` | `true` | Modo live (logs en stderr) |
| `TALEND_WORKSPACE` | - | Ruta al workspace de Talend Studio |
| `TALEND_PROJECT` | - | Ruta directa al proyecto (opcional) |
| `CONTROL_PLANE_API_KEY` | - | API key de OpenAI para el tunnel (se persiste en `.env.local`) |

## Herramientas disponibles

### Lectura e inspeccion

- `talend_detect_open_job` - detecta el job abierto en Talend Studio
- `talend_list_jobs` - lista los jobs del proyecto
- `talend_read_job` - devuelve resumen de un job
- `talend_read_contexts` - lee los contextos de un job
- `talend_list_project_contexts` - lista todos los contextos de todos los jobs del proyecto
- `talend_list_repository_contexts` - lista todos los contextos de repositorio del proyecto
- `talend_read_repository_context` - lee un contexto de repositorio completo con todas sus variables
- `talend_create_job` - crea un job nuevo, opcionalmente dentro de una carpeta
- `talend_create_folder` - crea una carpeta dentro de `process`
- `talend_rename_job` - renombra un job existente
- `talend_delete_job` - elimina un job existente
- `talend_duplicate_job` - duplica un job, con soporte para `sourceFolderPath` y `targetFolderPath`
- `talend_move_job_to_folder` - mueve un job completo a otra carpeta
- `talend_list_components` - lista componentes de un job
- `talend_show_flow` - muestra el flujo entre componentes
- `talend_read_contexts` - lee variables de contexto
- `talend_analyze_tdboutput` - analiza componentes tMysqlOutput/tDBOutput
- `talend_read_latest_run_log` - obtiene la ultima ejecucion
- `talend_read_job_errors` - errores historicos en `.metadata/.log`
- `talend_summarize_open_job` - resumen completo del job abierto
- `talend_inspect_component` - inspeccion detallada de un componente
- `talend_inspect_job` - inspeccion completa del job

### Edicion (solo en modo workspace local, no repo)

- `talend_update_component_parameter` - actualiza parametro de componente
- `talend_preview_component_parameter` - preview del cambio
- `talend_update_schema_column` - actualiza columna de schema
- `talend_preview_schema_column` - preview del cambio
- `talend_duplicate_component` - duplica un componente
- `talend_add_connection` - agrega conexion entre componentes
- `talend_update_context` - actualiza parametro de contexto
- `talend_upsert_context` - crea o actualiza parametro
- `talend_delete_context` - elimina parametro de contexto
- `talend_update_job_metadata` - actualiza nombre/descripcion/purpose
- `talend_create_repository_context` - crea un contexto de repositorio en `context/`
- `talend_upsert_repository_context_parameter` - crea o actualiza un parametro en un contexto de repositorio
- `talend_delete_repository_context` - elimina un contexto de repositorio completo

### Jobs y carpetas

- `talend_create_job` acepta `folderPath` para crear archivos dentro de `process/<carpeta>/`
- `talend_read_job`, `talend_update_job_metadata`, `talend_rename_job` y `talend_delete_job` aceptan `folderPath` para desambiguar jobs repetidos
- `talend_duplicate_job` acepta `sourceFolderPath` y `targetFolderPath`
- `talend_move_job_to_folder` mueve `*.item` y `*.properties` y actualiza `TalendProperties:ItemState path`

### Gestion de repositorios git

- `talend_repo_setup` - clona y activa un repo como proyecto
- `talend_repo_status` - estado del repo activo
- `talend_repo_pull` - pull del repo activo
- `talend_repo_switch` - cambia de repo activo
- `talend_repo_sources` - lista repos en cache

### Ejecucion

- `talend_run_job` - ejecuta un job de Talend Studio
- `talend_job_info` - informacion del script de ejecucion

---

## Uso con ChatGPT Web (OpenAI Secure MCP Tunnel)

Para conectar este servidor a ChatGPT via web necesitas el **Secure MCP Tunnel** de OpenAI,
que crea un enlace HTTPS saliente sin exponer el servidor al internet publico.

### Setup automatico (recomendado)

```bash
# 1. Clona e instala
git clone <repo-url> talend-mcp
cd talend-mcp
bun install

# 2. Inicia (descarga tunnel-client, pide API key y tunnel ID si es primera vez)
bun run start
```

El script te guiara paso a paso:

```
=== Talend MCP - Inicio automatizado ===
Sistema detectado: macOS (Apple Silicon)
Descargando tunnel-client...
Ingresa tu CONTROL_PLANE_API_KEY de OpenAI (sk-...):
Ingresa tu Tunnel ID (ej: tunnel_6a1f1012a92c8191931616ac46216eed):
```

La `CONTROL_PLANE_API_KEY` se persiste en `.env.local` (Bun la carga automaticamente).

### Prerequisitos

Antes de ejecutar, necesitas:

1. Una **API key** en https://platform.openai.com/settings/organization/api-keys
2. Un **tunnel** creado en https://platform.openai.com/settings/organization/tunnels
   (copia el Tunnel ID, ej: `tunnel_6a1f1012a92c8191931616ac46216eed`)

### Conectar en ChatGPT

1. Manten `bun run start` corriendo
2. Ve a https://chatgpt.com/#settings/Connectors
3. Presiona **+** y selecciona **Tunnel**
4. Elige el tunnel ID que creaste
5. ¡Listo! ChatGPT ya puede usar las herramientas de Talend

## Uso con ChatGPT Desktop (sin tunnel)

Si usas la app de escritorio de ChatGPT, puedes conectar directo sin tunnel:

1. Inicia el servidor: `bun run start:server`
2. En ChatGPT Desktop: Settings > Connectors > + > URL
3. Ingresa: `http://127.0.0.1:3927/mcp`

## Uso con otros clientes MCP (stdio)

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

### CLI local

```bash
bun run jobs list
bun run jobs read mi_job --folder-path carpeta_a
bun run jobs create mi_job --folder-path carpeta_nueva
bun run jobs duplicate mi_job mi_job_copia --source-folder-path carpeta_a --folder-path carpeta_b
bun run jobs move mi_job carpeta_destino/subcarpeta
bun run jobs create-folder carpeta_nueva/subcarpeta
bun run contexts list
```

## Ejemplo rapido (local)

1. `bun install`
2. `export TALEND_WORKSPACE="/ruta/al/workspace"`
3. `TALEND_MCP_FUNNEL=false bun run start`
4. Abre `http://127.0.0.1:3927/healthz` para verificar

## Solucion de problemas

- **No se ve la URL**: el modo por defecto ahora es `http`; si ves `$ bun run index.ts` sin mas,
  el servidor esta vivo pero en modo stdio. Verifica que `TALEND_MCP_MODE` sea `http`.
- **Tailscale Funnel falla**: usa `TALEND_MCP_FUNNEL=false` para desactivarlo.
- **No detecta el proyecto**: verifica que `TALEND_WORKSPACE` apunte a una ruta existente.
- **Job abierto no aparece**: asegurate de tener Talend Studio abierto con un editor activo.
- **Tunnel no aparece en ChatGPT**: verifica que `tunnel-client run` este corriendo y que el
  tunnel ID en ChatGPT coincida con el del perfil. Revisa `http://127.0.0.1:8080/ui`.
- **doctor falla**: asegurate que `CONTROL_PLANE_API_KEY` este definida y tenga permisos
  Tunnels **Read** + **Use** en platform.openai.com.
