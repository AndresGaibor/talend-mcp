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
│  new-server.ts           │   ├─ registro de tools (todas, ver bun run mapa)
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

El MCP tiene dos modos de operacion y no deben confundirse:

- **Inspeccion en disco**: puede listar y analizar `.item`, `.properties`, contextos y logs sin
  abrir Studio.
- **Edicion y ejecucion en vivo**: para crear y modificar jobs, configurar nodos y ejecutar codigo
  se usa la API del IDE mediante el plugin bridge. No edites `.item` a mano: Studio mantiene un
  modelo en memoria y el XML externo puede dejar el job inconsistente.

El handshake MCP da instrucciones para agentes nuevos. La tool `talend_guide` orienta en tareas,
schemas, reglas del dominio y estado del entorno. Para un cliente externo nuevo se recomienda
`TALEND_MCP_FILTER=agent`; `all` expone el catalogo completo y `core` limita las tools a una
seleccion esencial. La guia permanece visible con todos los presets y avisa si el preset no expone
los pasos necesarios para una tarea.

## 2. Capas del servidor

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Plataforma | `src/platform/` | Deteccion de SO (macos/windows/linux/wsl) y traduccion de rutas entre el host MCP y el host de Talend. |
| Config | `src/config/` | Contrato de variables de entorno. |
| Nucleo | `src/domain/`, `src/application/` | Entidades de job, workspace, analysis y los casos de uso que las usan. |
| Infraestructura | `src/infrastructure/` | Filesystem, git, XML y repositorios. |
| Dominio Talend | `src/talend/` | XML de jobs, contextos, Data Quality, mastery, diagnostico, ejecuciones, bridge y tools del IDE. |
| Modulos | `src/modules/` | Modulos con casos de uso y adapters propios: jobs, runs, secrets, datasets, snapshots, component-knowledge, component-definitions, studio-bridge, guide, errors, validation, evidence-pack y requirements. |
| Presentacion | `src/presentation/` | Tools por area (`tools/`) y el servidor HTTP/stdio (`server/`). |
| Servidor | `src/server/` | Registro de tools, adaptacion al MCP, esquemas de salida. |
| Compartido | `src/shared/` | Contratos: envelope `TalendResult`, result envelope. |

### Tools: dos ubicaciones, un solo registro

- **Tools de presentacion** (`src/presentation/tools/`): registro legacy organizado por areas.
- **Tools de modulo** (`src/modules/*/tools/`): casos de uso propios, schema Zod y contratos
  de salida.
- **Tools de Studio** (`src/talend/studio/tools-<area>.ts`): operaciones sobre bridge/IDE,
  componentes, ejecuciones, snapshots y especificaciones.

Las listas convergen en `getRegisteredServerTools()` (`src/presentation/server/tool-registry.ts`)
y `getModuleTools()` (`src/server/registered-tools.ts`), donde se adaptan al MCP y se aplican
presets. Flujo:

```text
implementacion -> registro -> adaptToolToMcp -> preset -> MCP tools/list -> tools/call
```

No agregues una tool sin conectarla al registro y probar que aparece con el preset esperado.
`docs/CATALOGO-DE-TOOLS.md` se genera con `bun run docs:tools`.

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
- Se instala (y actualiza) con el p2 director de Talend Studio. El flujo se orquesta en
  `scripts/install-bridge.ts` y sus etapas viven en `scripts/lib/` (`studio-detect`,
  `bridge-compile`, `bridge-hot-reload`, `p2-install`). Se ejecuta con `bun run bridge:install`;
  `bun run start` solo actualiza en caliente cuando el bridge no responde y Studio esta abierto.
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

El montaje de escenarios L5 empieza a separarse del acceso al bridge mediante planes puros en
`scripts/l5/`. `planJobAssembly` traduce alias y conectores (segun las definiciones de Studio) y
ordena las fases posteriores a conectar: re-aplicar schemas, configurar tablas y aplicar el modelo
del `tMap`. Se prueba sin abrir el IDE (`tests/talend/job-plan.test.ts`); el arnes L5 sigue siendo
la prueba de integracion en Studio. Esta capa se ampliara por pasos, sin reemplazar las tools MCP
ni escribir archivos `.item` directamente.
