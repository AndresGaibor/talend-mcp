# CLAUDE.md

Las instrucciones de este repositorio viven en **[AGENTS.md](AGENTS.md)**. Lelas primero: son
la fuente de verdad para cualquier agente de IA. Para ubicarte en el repo, ejecuta `bun run mapa`;
el indice de la documentacion esta en [docs/README.md](docs/README.md).

Resumen de lo imprescindible:

- **Usa Bun, no Node.** `bun <file>`, `bun test`, `bun run <script>`, `bunx <pkg>`.
  Bun carga `.env` solo: no agregues `dotenv`.
- **Verifica antes de commitear:** `bun run typecheck` y `bun test` deben pasar.
- **No hay apps ni UI.** El servidor expone solo tools MCP.
- **No hay tunnel ni exposicion publica.** El servidor es local (`127.0.0.1`) o stdio.
- **No hay aliases de tools.** Una sola tool por capacidad, siempre `talend_<area>_<verbo>`.
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
