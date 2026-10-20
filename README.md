# talend-mcp

Servidor MCP para analizar y editar proyectos de Qlik Talend Studio.

Sirve para inspeccionar jobs, componentes, contextos, flujos, logs y ejecutar modificaciones
sobre archivos `.item` y `.properties` de Talend.

## Instalación rápida

Necesitas [Bun](https://bun.sh) y un workspace de Talend Studio accesible desde esta máquina.
En Windows instala Bun desde PowerShell con `powershell -c "irm bun.sh/install.ps1|iex"`;
en macOS o Linux usa `curl -fsSL https://bun.sh/install | bash`. Abre una terminal nueva
después de instalarlo.

```bash
git clone https://github.com/AndresGaibor/talend-mcp.git
cd talend-mcp
bun install
```

Indica el proyecto Talend en `.env.local` para que el MCP lo encuentre directamente y no tenga
que explorar todo el workspace cada vez que usa una herramienta:

```dotenv
TALEND_PROJECT="C:/ruta/al/workspace/MI_PROYECTO"
```

El proyecto es la carpeta que contiene `talend.project`. En WSL usa su ruta Linux, por ejemplo
`/mnt/c/Users/usuario/Talend/workspace/MI_PROYECTO`.

### Conectar en esta máquina

```bash
bun run start:server
```

El servidor queda en `http://127.0.0.1:3927/mcp`. Para clientes que usan el protocolo stdio,
configura `bun run index.ts` como se muestra en [Clientes MCP](#uso-con-otros-clientes-mcp-stdio).

El script `bun run start` hace lo mismo que `start:server` y además libera el puerto si
estaba ocupado.

### Instalar el plugin opcional de Talend Studio

El plugin habilita la integración del bridge con Studio (job abierto, selección, ejecuciones,
markers). El instalador todo por CLI: detecta la instalación de Talend Studio y su JDK,
compila el plugin con Maven + Tycho, **desinstala la versión anterior** y instala la nueva.

```bash
bun run scripts/start.ts --install-bridge
```

Cierra Talend Studio antes (el script lo ofrece). Si ya tienes una versión anterior
instalada, se reemplaza automáticamente; no hay que desinstalar a mano.

Para verificar que quedó activo:

```bash
curl http://127.0.0.1:3930/ping
```

El bridge escucha en `127.0.0.1:3930` y pide un token que vive en
`~/.talend-bridge/token`. La configuración (`~/.talend-bridge/config.json`) deja el bridge en
modo solo lectura por defecto.

## Variables de entorno

| Variable | Default | Descripcion |
|---|---|---|
| `TALEND_MCP_MODE` | `http` | `http` o `stdio` |
| `TALEND_MCP_PORT` | `3927` | Puerto del servidor HTTP |
| `TALEND_MCP_HOST` | `127.0.0.1` | Host del servidor HTTP |
| `TALEND_MCP_LIVE` | `true` | Modo live (logs en stderr) |
| `TALEND_MCP_FILTER` | `canonical` | Preset de tools expuestas (`canonical`, `core`, `all`) |
| `TALEND_WORKSPACE` | - | Workspace de Talend Studio; el proyecto se autodetecta |
| `TALEND_PROJECT` | - | Ruta directa al proyecto; preferible para inicio rápido |
| `TALEND_DISABLE_AUTODETECT` | - | `1` desactiva la detección automática del proyecto |

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

### Conocimiento de componentes

- `talend_components_catalog_status` - estado del catalogo de componentes
- `talend_components_scan_installed` - escanea los plugins instalados
- `talend_components_catalog_rebuild` - reconstruye el catalogo local
- `talend_components_search` - busca componentes en el catalogo
- `talend_components_inspect` - inspecciona un componente
- `talend_components_extract_schema` - extrae el schema de un componente
- `talend_components_compare_schemas` - compara los schemas de dos componentes
- `talend_components_get_mapping_suggestions` - sugiere mapeos entre schemas

### Recetas y calidad

- `talend_recipe_generate` - genera una receta de flujo a partir de un objetivo
- `talend_recipe_get` - recupera una receta generada
- `talend_job_quality_report` - puntaje de calidad de un job con hallazgos
- `talend_job_quality_issues` - lista los hallazgos de calidad de un job

---

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

Para comprobar el estado del servidor, abre `http://127.0.0.1:3927/healthz`.

## Desarrollo

```bash
bun install          # dependencias
bun test             # suite completa (330+ tests)
bun run typecheck    # TypeScript sin emitir
```

La guia de trabajo para agentes de IA esta en [AGENTS.md](AGENTS.md). El mapa del repositorio
y las convenciones de arquitectura estan en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), y
las recetas para agregar tools, apps y cambios del plugin en
[docs/PLAN-DE-TRABAJO.md](docs/PLAN-DE-TRABAJO.md).

## Solucion de problemas

- **No se ve la URL**: el modo por defecto es `http`; si ves `$ bun run index.ts` sin mas,
  el servidor esta vivo pero en modo stdio. Verifica que `TALEND_MCP_MODE` sea `http`.
- **No detecta el proyecto**: verifica que `TALEND_WORKSPACE` apunte a una ruta existente o
  define `TALEND_PROJECT`.
- **Job abierto no aparece**: asegurate de tener Talend Studio abierto con un editor activo.
- **El puerto 3927 esta ocupado**: `bun run start` termina el proceso anterior antes de
  arrancar.
- **El bridge no responde en 3930**: el plugin debe estar instalado y Talend Studio abierto.
  Ver `docs/PLAN-DE-TRABAJO.md` para la tabla de errores del plugin.
