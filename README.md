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
compila el plugin con Maven + Tycho y **reemplaza** la versión anterior.

```bash
bun run scripts/start.ts --install-bridge
```

**No hace falta reiniciar Talend Studio.** Si Studio está corriendo, el instalador publica el
bundle en `~/.talend-bridge/hot/bridge.jar` y el plugin lo detecta y se recarga solo (el
servidor HTTP del bridge se reinicia con el código nuevo). Si Studio está cerrado, se instala
con el p2 director como siempre.

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

### Para agentes externos: empezar por `talend_guide`

El servidor entrega instrucciones MCP al inicializar. La primera llamada recomendada es
`talend_guide` en modo `overview`; devuelve las tareas, las familias disponibles y enlaces
`nextActions` para continuar. No hace falta aprenderse los nombres de las ~230 tools.

```json
{ "mode": "task", "task": "crear-job" }
```

Modos de `talend_guide`: `overview` (mapa), `task` (flujo paso a paso), `search` (busqueda en
lenguaje natural), `tool` (schema y condiciones de una tool), `rules` (reglas de Talend) y
`environment` (proyecto y estado del bridge). Siempre empieza con `overview` si no sabes que
pedir. Para clientes nuevos se recomienda `TALEND_MCP_FILTER=agent`: expone un subconjunto para
el ciclo habitual de un job sin cargar de golpe las ~230 tools. Usa `all` para descubrir todo y
`core` para una sesion restringida a herramientas esenciales. La guia sigue disponible con
cualquier preset y advierte cuando una tarea necesita tools no expuestas.

Consulta [docs/CATALOGO-DE-TOOLS.md](docs/CATALOGO-DE-TOOLS.md) para el inventario completo y
[docs/GUIA-AGENTE.md](docs/GUIA-AGENTE.md) para los detalles operativos de Talend Studio.

### Areas funcionales

El MCP agrupa capacidades para descubrir e inspeccionar jobs, crear y editar jobs en Studio,
contextos, componentes y schemas, ejecuciones e historiales, diagnostico de errores, validacion,
secretos, datasets, conexiones, Git, snapshots, Data Quality, mastery de componentes y entregables.
Usa `talend_guide` para elegir el flujo y [docs/CATALOGO-DE-TOOLS.md](docs/CATALOGO-DE-TOOLS.md)
para consultar nombres y argumentos exactos. No uses listas copiadas de versiones anteriores: el
catalogo se genera desde las tools registradas.

Las tools que leen archivos del proyecto funcionan sin Studio. Las que operan sobre el job abierto,
crean componentes o ejecutan codigo requieren Studio y el plugin bridge. Para modificar un job,
sigue el flujo `crear-job` o `editar-job` de `talend_guide`; no edites su `.item` a mano.

Tambien se puede llamar la API local del bridge directamente para diagnostico:
`bun run scripts/bridge-call.ts /ping`.

---

## Uso con otros clientes MCP (stdio)

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "index.ts"],
      "env": {
        "TALEND_WORKSPACE": "<ruta-al-workspace-de-talend>",
        "TALEND_MCP_FILTER": "agent"
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
bun run docs:tools   # regenera el catálogo navegable de tools
```

La guia de trabajo para agentes de IA esta en [AGENTS.md](AGENTS.md). El mapa del repositorio
y las convenciones de arquitectura estan en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), y
las recetas para agregar tools y cambios del plugin en
[docs/PLAN-DE-TRABAJO.md](docs/PLAN-DE-TRABAJO.md). Las APIs internas de Talend Studio que usa
el plugin Java estan en [docs/TALEND-STUDIO-INTERNALS.md](docs/TALEND-STUDIO-INTERNALS.md).

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
