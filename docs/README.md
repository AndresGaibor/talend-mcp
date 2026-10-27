# Documentación de talend-mcp

Índice de `docs/`. Si es tu primera vez en el repo, lee antes [AGENTS.md](../AGENTS.md)
(reglas y puntos de entrada) y ejecuta `bun run mapa` para ver la estructura viva.

## Qué leer según lo que vas a hacer

| Vas a... | Lee | Y luego |
|---|---|---|
| **Usar el MCP** para crear, editar o ejecutar jobs en un Studio abierto | [GUIA-AGENTE.md](GUIA-AGENTE.md) (flujo, reglas de configuración, errores) | [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md) |
| **Crear o editar muchos jobs sin Studio** (migraciones, lotes, plantillas) | [MODO-OFFLINE.md](MODO-OFFLINE.md) | [GUIA-AGENTE.md](GUIA-AGENTE.md) |
| **Cambiar el código** del servidor o de los scripts | [AGENTS.md](../AGENTS.md), [ARQUITECTURA.md](ARQUITECTURA.md) | [PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md) (recetas) |
| **Agregar una tool MCP** | [PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md) | [CATALOGO-DE-TOOLS.md](CATALOGO-DE-TOOLS.md) (generado) |
| **Tocar el plugin Java** (bridge) | [talend-studio-bridge/README.md](../talend-studio-bridge/README.md) | [studio-internals/04-bridge-e-instalacion.md](studio-internals/04-bridge-e-instalacion.md) |
| **Entender una API interna de Studio** o una trampa conocida | [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md) (índice por tema) | `studio-internals/` |
| **Preparar o revisar una prueba L5** (jobs con salida esperada) | [plan-de-pruebas/03-ejecucion-l5.md](plan-de-pruebas/03-ejecucion-l5.md) | [plan-de-pruebas/04-reglas-de-componentes.md](plan-de-pruebas/04-reglas-de-componentes.md) |
| **Saber qué componentes están probados** | [COBERTURA-POR-FAMILIA.md](COBERTURA-POR-FAMILIA.md) | [plan-de-pruebas/02-cobertura-del-catalogo.md](plan-de-pruebas/02-cobertura-del-catalogo.md) |
| **Ver el rumbo del proyecto** | [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md) | [REFACTOR-PENDIENTE.md](REFACTOR-PENDIENTE.md) |
| **Instalar en Windows o WSL** | [windows-wsl.md](windows-wsl.md) | [README.md](../README.md) |

## Estado de cada documento

**Vigentes**: el código manda sobre ellos; si encuentras una contradicción, arregla el documento
en el mismo cambio.

- `AGENTS.md`, `ARQUITECTURA.md`, `PLAN-DE-TRABAJO.md`: cómo está hecho el repo y cómo cambiarlo.
- `GUIA-AGENTE.md` y `guia-agente/`: cómo usar el MCP contra Studio.
- `TALEND-STUDIO-INTERNALS.md` y `studio-internals/`: APIs internas de Studio que usa el plugin.
- `plan-de-pruebas/`: criterios, fases y ejecución de las pruebas L5.
- `CATALOGO-DE-TOOLS.md`: **generado** con `bun run docs:tools`. No lo edites a mano.
- `PERFORMANCE.md`: qué tarda cada tipo de operación y por qué.

**De estado** (fotografía a una fecha; sirven para decidir, no para configurar):

- `COBERTURA-POR-FAMILIA.md`: qué familias de componentes están probadas a 22/10/2026.
- `ROADMAP-DOMINIO-TALEND.md`: objetivo y fases.
- `REFACTOR-PENDIENTE.md`: refactors en curso y lo que queda.
- `SAS-A-TALEND.md`: requisitos del flujo funcional que motiva el proyecto.

**Históricos** (no son fuente de verdad; se conservan por contexto):

- `HANDOFF.md`: traspaso de una sesión. Sus cifras de tests y de estado no están al día.
- `tool-migration.md`: migración de nombres de tools legacy, ya terminada.
- `component-template-generation.md` y `component-template-generation-results.json`: una prueba
  puntual del 20/10/2026.
- `historico/COMPONENTES-MAESTRIA-22.md`: el catálogo de la maestría de 22 componentes (antes estaba
  en la raíz del repo).

## Reglas para mantener esta documentación

- Los comandos se citan como `bun run <nombre>` y deben existir en `package.json`.
- Las rutas de repo que citan los mapas (`AGENTS.md`, `ARQUITECTURA.md`, `PLAN-DE-TRABAJO.md`,
  `GUIA-AGENTE.md`, `README.md`) deben existir: `tests/docs/entry-docs.test.ts` lo comprueba.
- No pongas cifras que cambian cada semana (número de tools, de tests, de componentes) en la
  prosa. Si hacen falta, dile al lector cómo obtenerlas (`bun run mapa`, `talend_guide`,
  `bun test`).
- Un documento nuevo se enlaza desde aquí, con su estado.
