# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[SemVer](https://semver.org/lang/es/). El workflow de release usa la sección de la versión como
notas del release: una versión sin sección no se publica.

## [0.1.6] - 2026-11-25

### Añadido

- `talend-mcp repair`: deja Studio en un estado seguro y al día. Apaga `autoDismissModals`, quita la tarea
  `TalendMcpSupervisor` que pulsaba diálogos cada 5 s, actualiza el plugin por p2 si Studio está cerrado,
  lo recarga en caliente si está abierto y borra el jar de carga en caliente anterior. Acepta `--dry-run`,
  `--from` y `--keep-supervisor`.
- Los instaladores ejecutan `repair` después de configurar los clientes. Un instalador anterior solo
  actualizaba el plugin en marcha; este deja también la copia instalada en Studio.

### Cambiado

- La pulsación automática de diálogos de Studio está apagada por defecto en el MCP y en el supervisor. Solo
  se activa con `TALEND_MODALS_AUTO=1`; antes bastaba con no poner `0`. Una ventana que abrió una persona ya
  no se guarda ni se cierra sola.
- Al instalar con p2 se borra el jar de carga en caliente anterior para que Studio arranque con la versión
  instalada y no recargue un build viejo.

## [0.1.5] - 2026-11-25

### Añadido

- `talend-mcp bridge uninstall`: quita el plugin del bridge de Talend Studio con el director de p2. Acepta
  `--dry-run`, exige Studio cerrado y no toca nada si el plugin no está instalado.
- Los desinstaladores ejecutan `bridge uninstall` antes de borrar el binario. Si Studio está abierto, avisan
  y dejan el plugin; si el binario es anterior a esta versión, dicen cómo actualizarlo.
- El README y la guía de instalación separan los tres niveles: desactivar en los clientes, borrar lo local y
  quitar el plugin de Studio.

### Cambiado

- `talend-mcp bridge` acepta `install` y `uninstall`; la ayuda de la CLI lista el comando nuevo.

## [0.1.4] - 2026-11-25

### Corregido

- El MCP ya no pulsa diálogos de Studio mientras escribe: la vigilancia que se añadió en 0.1.3 podía cerrar
  ventanas que abrió una persona. Ahora solo espera y reintenta cuando Studio responde que la interfaz está
  ocupada.
- El vigilante del supervisor y la recuperación tras un tiempo agotado solo aplican reglas propias (job
  existente, guardado, licencias, esquema del destino). Un diálogo desconocido se registra y se deja abierto.

### Cambiado

- `talend_studio_handle_modals` sigue cerrando diálogos desconocidos cuando se pide de forma explícita.

## [0.1.3] - 2026-11-25

### Añadido

- `talend_project_profile`: perfil de solo lectura y sin Studio con el inventario del proyecto, las
  convenciones de nombres, los huecos que hay que preguntar y los candidatos de reutilización para un
  propósito. Se expone en el preset `agent`.
- Tarea `disenar-job` en `talend_guide` y 14 reglas de criterio para reutilizar contextos, conexiones y
  jobs existentes, nombrar según el proyecto y no dejar jobs sin control de errores.
- Documento de diseño y plan de la línea de criterio profesional en `docs/superpowers/`.

### Corregido

- Las definiciones de componentes refrescan el índice una vez antes de responder que no existe y ya no
  afirman que un componente no está instalado solo porque falte su XML.
- La guarda de jobs abiertos reconoce títulos sin el prefijo `Job`/`Process` y no confunde `MIG_A` con
  `MIG_AB`.
- Las escrituras al bridge atienden los diálogos modales que aparecen durante la espera y reintentan
  cuando Studio responde que la interfaz está ocupada.

### Cambiado

- Las instrucciones del servidor y la skill indican diseñar el job (perfil del proyecto, reutilización y
  preguntas) antes de crearlo o editarlo.

## [0.1.2] - 2026-11-25

### Añadido

- Instaladores `uninstall.ps1` y `uninstall.sh`: quitan talend-mcp de los clientes MCP, el PATH de usuario
  y los datos locales (`~/.talend-mcp` y `~/.talend-bridge`). Piden confirmación y admiten
  `TALEND_MCP_YES=1` y `TALEND_MCP_KEEP_STATE=1`.
- Sección **Desinstalar o desactivar** en el README, con el comando para desactivar (`talend-mcp remove`)
  y el de desinstalación completa.

### Cambiado

- Los instaladores intentan instalar o actualizar el plugin Bridge automáticamente y explican qué hacer si
  Studio está abierto sin el plugin o no se detecta la instalación.
- Si no se detecta ningún cliente MCP, el instalador deja el binario instalado y muestra cómo registrar uno
  manualmente, en lugar de terminar sin instrucciones.

## [0.1.1] - 2026-11-19

### Añadido

- `talend-mcp bridge install`: instala o actualiza el plugin Java de Studio desde el release de la misma
  versión (descarga con checksum, p2 con Studio cerrado, recarga en caliente con Studio abierto), sin Maven
  ni clonar el repositorio. Admite `--dry-run` y `--from`.
- Cliente `copilot` en `setup` (formato nativo de Copilot, `~/.copilot/mcp-config.json`).
- Tabla de verificación por cliente en `docs/INSTALACION-CLIENTES.md`.

### Corregido

- El servidor compilado lanzado sin configuración (por ejemplo desde el plugin de Claude Code) guardaba su
  estado en la carpeta del proyecto; ahora usa `~/.talend-mcp/state`.
- `talend-mcp remove` ya no pide reiniciar el cliente.

### Cambiado

- README reorganizado: instalación primero, ejemplos de uso, modelo de seguridad y desplegables para
  lo secundario. La referencia de variables, los reintentos idempotentes y las ejecuciones asíncronas
  pasan a `docs/CONFIGURACION.md`, y la CLI a `docs/CLI.md`.

## [0.1.0] - 2026-11-19

Primera versión distribuible.

### Añadido

- **Binario único `talend-mcp`** para Windows, Linux y macOS (sin clonar ni `bun install`), con los
  comandos `serve`, `setup`, `remove`, `version`, `doctor`, `jobs` y `tools`.
- **`talend-mcp setup`**: configura Claude Code, Claude Desktop, VS Code (GitHub Copilot), Cursor,
  Gemini CLI y Codex CLI sin pisar la configuración existente (copia `.bak-talend-mcp` y `--dry-run`).
- **Instaladores** `install.ps1` e `install.sh` con verificación de checksum; volver a ejecutarlos
  actualiza.
- **Plugin de Claude Code** (`/plugin install`) con la skill `talend-mcp` y el servidor registrado.
- `TALEND_MCP_HOME`: fija el directorio de estado (catálogo, auditoría, ejecuciones) con
  independencia de dónde lance el cliente el proceso.
- Guía de instalación por cliente en `docs/INSTALACION-CLIENTES.md`.
- Licencia MIT.

### Corregido

- `talend_guide`, `talend_diagnose_environment`, `talend_job_quality_report` y `talend_snapshots_list`
  se clasificaban como escritura: con `TALEND_MCP_ALLOW_WRITE=0` se bloqueaban.
- `talend_search`, `talend_describe`, `talend_job_plan`, `talend_operations_status` y
  `talend_tail_run_output` se publicaban como no solo lectura y los clientes pedían confirmación en
  cada llamada.
- Con un directorio de estado vacío, `talend_component_describe` respondía "componente no
  encontrado": el catálogo ahora se construye desde Studio en el primer uso.
- `bun test` escribía en el `.talend-mcp/audit.jsonl` real y falseaba las métricas.
- `serverInfo.version` y `/healthz` informaban `1.0.0` fijo; ahora salen de `package.json`.
- Se sustituyeron por datos de ejemplo el nombre de un proyecto de cliente y un correo corporativo
  que aparecían en documentación, comentarios y fixtures.
