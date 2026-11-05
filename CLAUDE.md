# CLAUDE.md

Las instrucciones de este repositorio viven en **[AGENTS.md](AGENTS.md)**. Lelas primero: son
la fuente de verdad para cualquier agente de IA. Para ubicarte en el repo, ejecuta `bun run mapa`;
el indice de la documentacion esta en [docs/README.md](docs/README.md).

## Usar el MCP desde Claude Code

- El repo registra el servidor en [.mcp.json](.mcp.json): stdio, preset `agent`. Al abrir el
  repositorio, acepta el servidor del proyecto con `/mcp`; si no lo aceptas, veras `talend-mcp`
  como inactivo y ninguna tool `talend_*` disponible.
- La skill [.claude/skills/talend-mcp/SKILL.md](.claude/skills/talend-mcp/SKILL.md) explica cuando
  usarlo, el primer paso (`talend_guide { mode: "overview" }`), la estrategia offline/Studio y las
  reglas que rompen jobs. Cargala antes de operar sobre un proyecto Talend.
- Sin MCP, `bun run cli help` da lectura e inspeccion desde la terminal.
- Si no defines `TALEND_PROJECT`, el servidor usa el proyecto abierto en Studio. Para fijarlo,
  ponlo en `.env.local`, que Bun carga solo.

Resumen de lo imprescindible:

- **Usa Bun, no Node.** `bun <file>`, `bun test`, `bun run <script>`, `bunx <pkg>`.
  Bun carga `.env` solo: no agregues `dotenv`.
- **Verifica antes de commitear:** `bun run typecheck` y `bun test` deben pasar.
- **No hay apps ni UI.** El servidor expone solo tools MCP.
- **No hay tunnel ni exposicion publica.** El servidor es local (`127.0.0.1`) o stdio.
- **No hay aliases de tools.** Una sola tool por capacidad, siempre `talend_<area>_<verbo>`.
- **Estrategia mixta:** offline (`talend_jobs_create_batch`, `talend_job_edit_offline`, `talend_jobs_edit_batch`,
  `talend_job_build_batch`) para migraciones, lotes y jobs cerrados; Studio en vivo para jobs abiertos y tMap.
  Detalle en [docs/MODO-OFFLINE.md](docs/MODO-OFFLINE.md).
- **Verifica con `talend_job_verify`.** Una llamada: diseno, compilacion, ejecucion y avisos
  (`[WARN]`/`[ERROR]`/`[FATAL]`, excepciones) aunque el job termine con codigo 0. Informa de cada
  aviso. Detalle en AGENTS.md, seccion 0.
- **El plugin Java se instala por CLI:** `bun run scripts/start.ts --install-bridge`.

Mapas utiles:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) - mapa del repositorio y las capas.
- [docs/PLAN-DE-TRABAJO.md](docs/PLAN-DE-TRABAJO.md) - recetas para agregar tools y cambios en el
  plugin.
- [docs/tool-migration.md](docs/tool-migration.md) - migracion de tools legacy a canonicas.
- [docs/TALEND-STUDIO-INTERNALS.md](docs/TALEND-STUDIO-INTERNALS.md) - APIs internas de Talend
  Studio que usa el plugin: tipos de columna validos, flujo de ejecucion de un job y recarga
  del modelo en memoria.

Documentacion de la API de Bun: `node_modules/bun-types/docs/**.mdx`.
