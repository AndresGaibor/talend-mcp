# ARQUITECTURA

Mapa del repositorio `talend-mcp`. Para las reglas de trabajo mira [AGENTS.md](../AGENTS.md).

## 1. Vision general

```
┌──────────────────────────┐
│   Cliente MCP (host)     │
│  (cualquier cliente MCP  │
│   local por HTTP/stdio)  │
└───────────┬──────────────┘
            │ HTTP / SSE / stdio
┌───────────▼──────────────┐
│      Servidor MCP        │   index.ts
│  new-server.ts           │   ├─ registro de tools (~200)
│  registered-tools.ts     │   └─ dispatch JSON-RPC
└───────────┬──────────────┘
            │
   ┌────────┴─────────┬──────────────────┐
   ▼                  ▼                  ▼
┌─────────┐   ┌─────────────┐   ┌──────────────┐
│ Talend  │   │  Workspace  │   │    Bridge    │
│  files  │   │  (proyecto  │   │  (plugin     │
│ .item   │   │   Talend)   │   │   Java)      │
│ .propert│   └─────────────┘   │  localhost   │
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
| Config | `src/config/` | Contrato de variables de entorno. |
| Nucleo | `src/domain/`, `src/application/` | Entidades de job, workspace, analysis y los casos de uso que las usan. |
| Infraestructura | `src/infrastructure/` | Filesystem, git, XML y repositorios. |
| Dominio Talend | `src/talend/` | Todo lo que sabe de Talend: XML de jobs, contextos, Data Quality, mastery, diagnostico, ejecuciones y las tools de estudio. |
| Modulos | `src/modules/` | Modulos con casos de uso y adapters propios (datasets, secrets, studio-bridge, component-knowledge, evidence-pack, requirements, runs, errors, validation, snapshots). |
| Presentacion | `src/presentation/` | Tools por area (`tools/`) y el servidor HTTP/stdio (`server/`). |
| Servidor | `src/server/` | Registro de tools, adaptacion al MCP, esquemas de salida. |
| Compartido | `src/shared/` | Contratos: envelope `TalendResult`, result envelope. |

### Tools: dos ubicaciones, un solo registro

- **Tools de modulo** (`src/modules/*/tools/`): casos de uso propios, schema Zod,
  `structuredContent` con el payload en `data`.
- **Tools de estudio** (`src/talend/studio/tools-<area>.ts`): lo que necesita el IDE en vivo
  (bridge, componentes, snapshots, ejecuciones, specs de pipeline).

Ambas familias se ensamblan en `src/presentation/server/tool-registry.ts` y se registran en
`getModuleTools()` (`src/server/registered-tools.ts`). No hay aliases: cada capacidad tiene
una sola tool, llamada `talend_<area>_<verbo>`.

## 3. Plugin Java (bridge)

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

## 4. Cross-platform

El repo corre en Windows, macOS, Linux y WSL. La pieza clave es `src/platform/path-bridge.ts`:
traduce rutas entre el host donde corre el MCP y el host donde corre Talend Studio.

Reglas practicas:

- Nunca compares rutas con `toContain("a/b")` sobre rutas nativas: normaliza con
  `path.replace(/\\/g, "/")`.
- Nunca uses `/dev/null`: usa `os.devNull` o un temporal.
- Los tests que simulan otro SO deben restaurar `process.platform` en un `afterEach`.

`tests/platform/portability.test.ts` falla si aparece una ruta personal en `src/` o `scripts/`.

## 5. Tests

```
tests/
├── tools/        registro, contratos, schemas, seguridad, convencion de nombres
├── presentation/ envelope de resultado
├── talend/       jobs, contextos, DQ, logs, workspace, ejecuciones, diagnostico
├── platform/     deteccion de SO y portabilidad de rutas
└── fixtures/     archivos de ejemplo de Talend
```

Todos los tests corren con `bun test`. `bunfig.toml` acota la busqueda a `tests/`.
