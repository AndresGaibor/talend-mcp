# ARQUITECTURA

Mapa del repositorio `talend-mcp`. Para las reglas de trabajo mira [AGENTS.md](../AGENTS.md).

## 1. Vision general

```
┌──────────────────────────┐
│   Cliente MCP (host)     │
│  Claude / cualquier      │
│  cliente MCP local       │
└───────────┬──────────────┘
            │ HTTP / SSE / stdio
┌───────────▼──────────────┐
│      Servidor MCP        │   index.ts
│  new-server.ts           │   ├─ registro de tools (321)
│  registered-tools.ts     │   ├─ resources ui://talend/*  (40 apps)
│                          │   └─ apresentacion de apps
└───────────┬──────────────┘
            │
   ┌────────┴─────────┬──────────────────┬──────────────────┐
   ▼                  ▼                  ▼                  ▼
┌─────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│ Talend  │   │  Workspace  │   │    Bridge    │   │     Apps     │
│  files  │   │  (proyecto  │   │  (plugin     │   │  (HTML       │
│ .item   │   │   Talend)   │   │   Java)      │   │  generado)   │
│ .propert│   └─────────────┘   │  localhost   │   └──────────────┘
└─────────┘                     │  :3930       │
                                └──────────────┘
```

El servidor trabaja **sin** Talend Studio abierto: lee y escribe los archivos del proyecto
directamente. El plugin Java solo hace falta para lo que exige el IDE en vivo (job abierto,
seleccion, ejecuciones, markers).

## 2. Capas del servidor

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Plataforma | `src/platform/` | Deteccion de SO (macos/windows/linux/wsl) y traduccion de rutas entre el host MCP y el host de Talend. |
| Nucleo | `src/domain/`, `src/application/` | Entidades, puertos y casos de uso transversales. |
| Infraestructura | `src/infrastructure/` | Filesystem, git, XML y repositorios. |
| Dominio Talend | `src/talend/` | Todo lo que sabe de Talend: XML de jobs, contextos, Data Quality, mastery, diagnostico, ejecuciones. |
| Modulos | `src/modules/` | Modulos hexagonales autonomos con `domain/`, `application/`, `ports/`, `adapters/`, `tools/`. |
| Presentacion | `src/presentation/` | Tools por area (`tools/`), apps HTML (`apps/`). |
| Servidor | `src/server/` | Registro de tools, adaptacion al MCP, esquemas de salida. |
| Compartido | `src/shared/` | Contratos: envelope `TalendResult`, result envelope. |

### Modulos (`src/modules/`)

Cada modulo es una unidad de negocio con sus propias tools:

```
snapshots/     secrets/      datasets/      deliverables/   jobs/
requirements/  runs/         errors/        validation/     evidence-pack/
apps/          component-knowledge/          studio-bridge/
```

`component-knowledge/` es el mas rico: catalogo de componentes, mastery, recetas y schemas.

### Tools: dos familias conviven

- **Tools de presentacion** (`src/presentation/tools/`): planas, sin esquema Zod, devuelven
  strings o envelopes simples. Son las historicas.
- **Tools de modulo** (`src/modules/*/tools/`): schema Zod, `structuredContent` con el
  payload en `data`, anotaciones de seguridad.

Las tools canonicas son las de modulo. Las de presentacion siguen vivas por compatibilidad y
se van migrando (ver `docs/tool-migration.md`).

El registro de tools vive en un solo lugar: `getModuleTools()` en
`src/server/registered-tools.ts`.

## 3. Apps

Cada app es un recurso MCP `ui://talend/<id>.html` cuyo cuerpo es HTML generado en el
servidor (`src/presentation/apps/legacy-shells/`), mas una tool lanzadora `talend_app_<id>`.

Flujo:

1. El cliente llama `talend_app_<id>`.
2. El launcher arma el estado inicial (`app-state.ts`) y devuelve `resourceUri`.
3. El cliente pide el recurso y renderiza el HTML.
4. El HTML llama tools por `window.openai.callTool`.

Detalle y pasos para agregar una app: [mcp-apps-ui.md](mcp-apps-ui.md).

## 4. Plugin Java (bridge)

`talend-studio-bridge/` es un bundle Eclipse RCP (Tycho) que expone Talend Studio por HTTP
en `127.0.0.1:3930`.

```
talend-studio-bridge/
├── com.andres.talend.bridge/            bundle: servidor HTTP, servicios, auditoria
├── com.andres.talend.bridge.feature/    feature p2
└── com.andres.talend.bridge.repository/ update site que se instala
```

- Se compila con Maven + Tycho contra un release de Eclipse y Gson desde Orbit.
- Se instala (y actualiza) con el p2 director de Talend Studio. Todo el flujo vive en
  `scripts/install-bridge.ts`, se ejecuta con `bun run scripts/start.ts --install-bridge`.
- El token de autenticacion vive en `~/.talend-bridge/token` y la configuracion en
  `~/.talend-bridge/config.json` (modo lectura por defecto).

Endpoints: `/ping`, `/capabilities`, `/audit/environment`, `/workbench/*`, `/workspace/*`,
`/problems/markers`, `/talend/*`, `/commands/*`, `/launch/*`, `/events/*`,
`/automation/run-active-job`.

## 5. Cross-platform

El repo corre en Windows, macOS, Linux y WSL. La pieza clave es `src/platform/path-bridge.ts`:
traduce rutas entre el host donde corre el MCP y el host donde corre Talend Studio.

Reglas practicas:

- Nunca compares rutas con `toContain("a/b")` sobre rutas nativas: normaliza con
  `path.replace(/\\/g, "/")`.
- Nunca uses `/dev/null`: usa `os.devNull` o un temporal.
- Los tests que simulan otro SO deben restaurar `process.platform` en un `afterEach`.

`tests/platform/portability.test.ts` falla si aparece una ruta personal en `src/` o `scripts/`.

## 6. Tests

```
tests/
├── tools/        registro, contratos, schemas, seguridad, deprecaciones
├── apps/         registro de apps y launchers
├── presentation/ envelope de resultado y registro de apps
├── talend/       jobs, contextos, DQ, logs, workspace, ejecuciones, diagnostico
├── platform/     deteccion de SO y portabilidad de rutas
├── legacy/       alias legacy de tools
└── fixtures/     archivos de ejemplo de Talend
```

Todos los tests corren con `bun test`. `bunfig.toml` acota la busqueda a `tests/`.
