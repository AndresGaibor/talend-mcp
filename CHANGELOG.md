# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[SemVer](https://semver.org/lang/es/). El workflow de release usa la sección de la versión como
notas del release: una versión sin sección no se publica.

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
