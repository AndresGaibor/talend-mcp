# Conectar talend-mcp a un cliente MCP

Guía para dejar el servidor funcionando en Claude Code, Claude Desktop, GitHub Copilot (VS Code),
Cursor, Codex CLI y Gemini CLI. Todos usan el mismo servidor; solo cambia el archivo donde se declara.

## 1. Instalación rápida (recomendada)

No hace falta clonar el repositorio ni instalar Bun: cada release publica un binario único.

**Windows (PowerShell):**

```powershell
irm https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.ps1 | iex
```

**Linux y macOS:**

```bash
curl -fsSL https://github.com/AndresGaibor/talend-mcp/releases/latest/download/install.sh | sh
```

El instalador descarga el binario a `~/.talend-mcp/bin`, comprueba su SHA-256 contra
`checksums.txt` del mismo release (si no coincide, no instala), lo añade al PATH y ejecuta
`talend-mcp setup`, que **detecta tus clientes y los configura**:

```bash
talend-mcp setup --dry-run                  # ver qué haría, sin escribir nada
talend-mcp setup                            # configurar todos los clientes detectados
talend-mcp setup --client cursor,vscode     # solo algunos
talend-mcp setup --project "C:/ruta/al/proyecto"   # fijar el proyecto (TALEND_PROJECT)
talend-mcp remove                           # quitar talend-mcp de los clientes
```

Clientes soportados: `claude-code`, `claude-desktop`, `vscode`, `copilot` (GitHub Copilot CLI y formato
nativo de Copilot), `cursor`, `gemini`, `codex`. `setup` no toca otros servidores que ya tengas: solo escribe la entrada
`talend-mcp`, guarda una copia `<archivo>.bak-talend-mcp` la primera vez, y si un archivo no es
JSON válido (por ejemplo, con comentarios) lo deja intacto y te lo dice. Reinicia el cliente después.

**Actualizar:** vuelve a ejecutar el instalador. Cierra antes el cliente que tenga el servidor abierto.
Para comprobar la versión: `talend-mcp version`.

**Variables del instalador:** `TALEND_MCP_NO_SETUP=1` (solo instala el binario),
`TALEND_MCP_NO_PATH=1` (no toca el PATH), `TALEND_MCP_RELEASE_URL` (otra fuente, por ejemplo un espejo
interno).

### Alternativa: plugin de Claude Code

Con el binario ya instalado, el plugin añade la skill que enseña a usar el MCP y registra el servidor:

```
/plugin install talend-mcp --marketplace AndresGaibor/talend-mcp
```

### Plugin de Studio (trabajo en vivo)

Para crear y editar jobs abiertos en Studio hace falta el plugin Java. Un comando lo instala desde el
release de tu misma versión (descarga `talend-bridge-p2.zip`, comprueba su SHA-256 y usa el director de p2
de tu Studio):

```bash
talend-mcp bridge install --dry-run   # comprueba todo y explica qué haría, sin tocar Studio
talend-mcp bridge install
```

| Situación de Studio | Qué hace |
|---|---|
| **Cerrado** | Instala (o actualiza) el plugin con p2. Es la primera instalación. |
| **Abierto con el plugin cargado** | Actualiza en caliente, sin reiniciar Studio. |
| **Abierto sin el plugin** | Se niega y te pide cerrarlo: p2 no puede instalar con Studio corriendo. |

Si Studio no se detecta, define `TALEND_STUDIO_HOME` (la carpeta con `plugins/` y `features/`). Sin red,
descarga el zip del release y usa `talend-mcp bridge install --from <zip|carpeta>`. La instalación manual
sigue disponible: en Studio, **Help, Install New Software, Add, Archive**. Sin el plugin funciona el modo
offline (lotes, migraciones, jobs cerrados): ver [MODO-OFFLINE.md](MODO-OFFLINE.md).

## 2. Instalación desde el código

Para desarrollar o probar cambios:

| Requisito | Cómo comprobarlo |
|---|---|
| [Bun](https://bun.sh/) instalado | `bun --version` |
| Dependencias del repo | `bun install` dentro del repositorio |
| Un proyecto de Talend Studio | La carpeta que contiene `talend.project` |

Desde el clon, `bun run cli setup` configura los clientes apuntando al repositorio (con `bun run
--cwd`). Si prefieres hacerlo a mano, la configuración base:

| Dato | Valor |
|---|---|
| Comando | `bun` |
| Argumentos | `run`, `--cwd`, `<RUTA_AL_REPO>`, `index.ts` |
| Modo | `TALEND_MCP_MODE=stdio` |
| Herramientas visibles | `TALEND_MCP_FILTER=agent` |
| Proyecto (opcional) | `TALEND_PROJECT=<RUTA_AL_PROYECTO>` |

Por qué `--cwd`: los clientes de escritorio lanzan el proceso desde una carpeta cualquiera, y el
servidor guarda su auditoría (`.talend-mcp/audit.jsonl`), el historial de ejecuciones y el registro
de idempotencia relativos a esa carpeta. Con `--cwd` quedan siempre dentro del repo.

Si `TALEND_PROJECT` no está definido, el servidor usa el proyecto abierto en Studio. Fíjalo cuando
trabajes sin Studio o con varios workspaces. En Windows usa barras normales
(`C:/Talend/workspace/MI_PROYECTO`) o escapa las barras invertidas en JSON.

> Si el cliente no encuentra `bun` (típico en Claude Desktop en Windows, que no hereda el `PATH`
> del usuario), pon la ruta completa: `C:/Users/<usuario>/.bun/bin/bun.exe`.

## 3. Configuración manual por cliente

Si usas el binario, el comando es `talend-mcp` con el argumento `serve` en lugar de `bun run --cwd ...`.
Los formatos son los de cada cliente en el momento de escribir esto; si una versión nueva cambia
algo, manda su documentación.

### Claude Code

El repositorio ya trae [.mcp.json](../.mcp.json). Abre Claude Code dentro del repo y acepta el
servidor con `/mcp`. Para registrarlo desde otra carpeta:

```bash
claude mcp add talend-mcp --scope user \
  -e TALEND_MCP_MODE=stdio -e TALEND_MCP_FILTER=agent -e TALEND_PROJECT="C:/ruta/al/proyecto" \
  -- bun run --cwd "C:/ruta/a/talend-mcp" index.ts
```

Comprueba con `claude mcp list` (debe aparecer conectado) y dentro de la sesión con `/mcp`.

### Claude Desktop

Edita `claude_desktop_config.json` (menú Configuración, Desarrollador, Editar configuración):

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "talend-mcp": {
      "command": "bun",
      "args": ["run", "--cwd", "C:/ruta/a/talend-mcp", "index.ts"],
      "env": {
        "TALEND_MCP_MODE": "stdio",
        "TALEND_MCP_FILTER": "agent",
        "TALEND_PROJECT": "C:/ruta/al/proyecto"
      }
    }
  }
}
```

Reinicia Claude Desktop del todo (también desde la bandeja del sistema).

### GitHub Copilot en VS Code

Crea `.vscode/mcp.json` en tu workspace, o usa el comando **MCP: Open User Configuration** para
dejarlo disponible en todos. Ojo: aquí la clave raíz es `servers`, no `mcpServers`.

```json
{
  "servers": {
    "talend-mcp": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "--cwd", "C:/ruta/a/talend-mcp", "index.ts"],
      "env": {
        "TALEND_MCP_MODE": "stdio",
        "TALEND_MCP_FILTER": "agent",
        "TALEND_PROJECT": "C:/ruta/al/proyecto"
      }
    }
  }
}
```

Pasos: abre el chat de Copilot, cambia a modo **Agent**, pulsa el icono de herramientas y comprueba
que `talend-mcp` está activo (VS Code muestra un botón **Start** sobre el servidor en el JSON).

En cuentas Copilot Business o Enterprise, un administrador debe tener habilitada la política
**MCP servers in Copilot**; si no, el servidor se carga pero Copilot no lo usa.

### Cursor

`.cursor/mcp.json` en el proyecto, o `~/.cursor/mcp.json` para todos. Mismo contenido que Claude
Desktop (clave `mcpServers`). Actívalo en Configuración, MCP.

### Codex CLI

En `~/.codex/config.toml`:

```toml
[mcp_servers.talend-mcp]
command = "bun"
args = ["run", "--cwd", "C:/ruta/a/talend-mcp", "index.ts"]

[mcp_servers.talend-mcp.env]
TALEND_MCP_MODE = "stdio"
TALEND_MCP_FILTER = "agent"
TALEND_PROJECT = "C:/ruta/al/proyecto"
```

### Gemini CLI

En `~/.gemini/settings.json`, mismo bloque `mcpServers` que Claude Desktop.

### Cualquier otro cliente

- Si acepta `stdio`: la configuración base de la sección 2.
- Si solo acepta una URL HTTP: ejecuta `bun run start` y apunta el cliente a
  `http://127.0.0.1:3927/mcp`. Escucha solo en loopback; para abrirlo a otra máquina hace falta
  `TALEND_MCP_TOKEN` (ver [Configuración](CONFIGURACION.md)).

## 4. Comprobar que funciona

1. Pide al asistente: *"Ejecuta `talend_guide` con `mode: overview`"*. Debe contestar sin pedirte
   confirmación. Es la primera llamada de cualquier sesión.
2. Pide *"ejecuta `talend_bridge_ping`"* si Studio está abierto: confirma el plugin.
3. Pide *"ejecuta `talend_diagnose_environment`"*: resume proyecto, Studio, bridge y permisos.
4. Desde la terminal, sin cliente: `bun run doctor`.

### Qué está verificado y cómo

| Cliente | Verificación |
|---|---|
| Claude Code | **Probado con el cliente real**: `setup` registra el servidor, `claude mcp list` lo conecta (✔ Connected), repetirlo no duplica y `remove` lo quita. El plugin se instaló desde el marketplace de GitHub y su servidor también conectó. |
| Claude Desktop, VS Code, Cursor, Gemini CLI, Codex CLI, Copilot | Formato y ruta **contrastados con la documentación oficial** de cada cliente (19/11/2026), no probados con el cliente real. Si uno falla, usa `--dry-run` para ver qué se escribiría y abre un issue con la versión del cliente. |

Notas de la documentación de cada cliente:

- **VS Code** documenta el formato `servers` de `mcp.json` como "harness local", que anuncia que se retirará en
  febrero de 2027, y propone el formato nativo de Copilot (`~/.copilot/mcp-config.json`, clave
  `mcpServers`). Por eso `setup` ofrece los dos: `vscode` y `copilot`.
- **Gemini CLI** indica en su documentación que fue sustituido por Antigravity CLI el 18/06/2026. `setup`
  sigue escribiendo su `~/.gemini/settings.json`; Antigravity no está soportado todavía.
- **Codex CLI** no documenta qué variables de entorno hereda un servidor MCP. `talend-mcp` solo necesita las que
  `setup` escribe en el bloque `env`.

## 5. Permisos y modo solo lectura

Por defecto el servidor permite leer, escribir y ejecutar, y bloquea lo destructivo salvo con
`confirm: true` y `TALEND_MCP_ALLOW_DESTRUCTIVE=1`. Se ajusta en el bloque `env` del cliente:

| Quiero... | Variables |
|---|---|
| Solo leer e inspeccionar | `TALEND_MCP_ALLOW_WRITE=0` y `TALEND_MCP_ALLOW_EXECUTE=0` |
| Editar pero no ejecutar jobs | `TALEND_MCP_ALLOW_EXECUTE=0` |
| Permitir borrados (con `confirm: true`) | `TALEND_MCP_ALLOW_DESTRUCTIVE=1` |

Cada llamada queda en `.talend-mcp/audit.jsonl` (herramienta, riesgo, resultado y duración, sin los
argumentos). `TALEND_MCP_LOG=quiet` lo desactiva.

## 6. Problemas frecuentes

| Síntoma | Causa y arreglo |
|---|---|
| El cliente dice "spawn bun ENOENT" o no arranca | No encuentra `bun`. Usa la ruta completa al ejecutable. |
| Conecta pero no aparece ninguna tool `talend_*` | En Claude Code, acepta el servidor con `/mcp`. En VS Code, pulsa **Start** y activa las tools en el selector. |
| "Failed to parse message" o el cliente se cuelga al iniciar | Algo escribió en stdout. En `stdio` solo debe salir JSON-RPC; revisa que no hayas añadido `console.log` y que el comando sea el de la sección 2 y no `bun run start`. |
| Pregunta confirmación en cada lectura | Tool de lectura publicada como escritura. Actualiza el repo: ya se corrigió en `talend_guide`, `talend_search`, `talend_describe`, `talend_job_plan`, `talend_operations_status` y `talend_tail_run_output`. |
| No encuentra el proyecto | Revisa `TALEND_PROJECT`: la carpeta debe contener `talend.project`. |
| `talend_bridge_ping` falla | Studio cerrado o plugin sin instalar. `bun run bridge:install`, abre Studio y `bun run doctor`. |
| Las llamadas a Studio se cuelgan | Un diálogo de Studio bloquea el bridge. Ver [SOLUCION-DE-PROBLEMAS.md](SOLUCION-DE-PROBLEMAS.md). |
| Servidor en WSL y Studio en Windows | Ver [windows-wsl.md](windows-wsl.md). |
