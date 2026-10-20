# CLAUDE.md

Las instrucciones de este repositorio viven en **[AGENTS.md](AGENTS.md)**. Lelas primero: son
la fuente de verdad para cualquier agente de IA.

Resumen de lo imprescindible:

- **Usa Bun, no Node.** `bun <file>`, `bun test`, `bun run <script>`, `bunx <pkg>`.
  Bun carga `.env` solo: no agregues `dotenv`.
- **Verifica antes de commitear:** `bun run typecheck` y `bun test` deben pasar.
- **No hay `apps-ui/`** (se elimino). Las UIs se generan en el servidor como HTML
  autocontenido.
- **No hay tunnel ni exposicion publica.** El servidor es local (`127.0.0.1`) o stdio.
- **El plugin Java se instala por CLI:** `bun run scripts/start.ts --install-bridge`.

Mapas utiles:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) - mapa del repositorio y las capas.
- [docs/PLAN-DE-TRABAJO.md](docs/PLAN-DE-TRABAJO.md) - recetas para agregar tools, apps y
  cambios en el plugin.
- [docs/mcp-apps-ui.md](docs/mcp-apps-ui.md) - como registrar una app HTML.
- [docs/tool-migration.md](docs/tool-migration.md) - migracion de tools legacy a canonicas.

Documentacion de la API de Bun: `node_modules/bun-types/docs/**.mdx`.
