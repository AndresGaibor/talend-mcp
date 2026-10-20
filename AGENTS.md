# AGENTS.md

Instrucciones para agentes de IA que trabajan en **talend-mcp**.

Este archivo es la fuente de verdad. Si una regla aqui contradice una costumbre mia, gana este
archivo. `CLAUDE.md` solo guarda el detalle de Bun y apunta aqui.

## 1. Que es el repo

Servidor MCP (Model Context Protocol) que analiza y edita proyectos de **Qlik Talend Studio**
sobre los archivos `.item` y `.properties` de un workspace de Talend.

El servidor expone ~200 herramientas MCP. No tiene interfaz grafica propia: la consumes desde
un cliente MCP.

## 2. Stack y comandos

| Comando | Que hace |
|---|---|
| `bun install` | Instala dependencias. **Nunca** uses npm, yarn o pnpm. |
| `bun test` | Suite completa (280+ tests). Solo corre `tests/`. |
| `bun run typecheck` | `tsc --noEmit`. Debe terminar sin errores. |
| `bun run start:server` | Levanta el servidor MCP en `http://127.0.0.1:3927/mcp`. |
| `bun run start` | Igual que `start:server`, ademas libera el puerto 3927 si esta ocupado. |
| `bun run scripts/start.ts --install-bridge` | Compila y publica el plugin Java. Si Talend Studio esta corriendo, se recarga en caliente. |
| `bun run jobs ...` / `bun run contexts ...` | CLI local para jobs y contextos. |

Reglas de Bun (proyecto, no Node):

- `bun <file>` en vez de `node <file>` o `ts-node`.
- `bun test` en vez de `jest` o `vitest`.
- `bun run <script>` en vez de `npm run <script>`.
- `bunx <pkg>` en vez de `npx <pkg>`.
- Bun carga `.env` solo: no agregues `dotenv`.
- `Bun.serve()`, `Bun.file()`, `bun:sqlite`, `Bun.$` ya estan disponibles.

## 3. Estado del repositorio

- **No hay apps ni UI.** No existe `apps-ui/` ni la capa `src/presentation/apps/`. El servidor
  expone solo tools.
- **No hay tunnel ni Tailscale Funnel.** El servidor es local (`127.0.0.1`) o stdio.
  No reintroduzcas `CONTROL_PLANE_API_KEY`, `TALEND_MCP_FUNNEL` ni `src/tailscale/`.
- **No hay exposicion publica.** Si necesitas acceso remoto, resuelvelo con el cliente MCP,
  no con un proxy dentro del repo.
- **No hay ChatGPT Web.** El unico host es un cliente MCP local.
- **No hay aliases de tools.** Toda tool se llama `talend_<area>_<verbo>` y hay una sola tool
  por capacidad. No reintentes el mecanismo de aliases legacy.
- **El registro de tools vive en un solo lugar:** `getModuleTools()` en
  `src/server/registered-tools.ts`, que consume `src/presentation/server/tool-registry.ts`.
- **No hay codigo muerto.** Si agregas un archivo, conectalo: los barridos de referencias
  orfas son parte de la revision.
- **`entregables/` y `evidencias/`** son salidas generadas y no se versionan.
- **El plugin Java se recarga en caliente.** `bun run scripts/start.ts --install-bridge`
  publica el bundle en `~/.talend-bridge/hot/bridge.jar` y el plugin lo detecta y se
  recarga solo (`Bundle.update`). No reinicies Talend Studio para aplicar cambios.

## 4. Reglas de oro

1. **No rompas los tests para hacerlos pasar.** Si un test falla, primero entiende si el codigo
   esta mal (arregla el codigo) o si el test estaba desactualizado (actualiza el test y explica
   por que en el mensaje del commit).
2. **Un cambio, un concern.** No mezcles refactors con features en el mismo cambio.
3. **TypeScript estricto.** `strict`, `noUncheckedIndexedAccess` y `noImplicitOverride` estan
   activos. Los indices de array se acceden con `!` o con una guarda explicita.
4. **Sin rutas hardcodeadas.** Nunca escribas rutas absolutas de una maquina concreta
   (`/Users/alguien`, `/Applications/TalendStudio-8.0.1`, `C:/Users/...`). Hay un test que lo
   verifica: `tests/platform/portability.test.ts`.
5. **Portable entre Windows, macOS, Linux y WSL.** Compara rutas con separadores normalizados,
   nunca con `toContain("carpeta/subcarpeta")` sobre una ruta nativa.
6. **No mutes globales de proceso en tests.** Si necesitas simular otro sistema operativo,
   restaura `process.platform` y `WSL_DISTRO_NAME` en un `afterEach`.
7. **Comentarios y mensajes en espanol**, codigo e identificadores en ingles.

## 5. Estructura del repositorio

```
index.ts                     punto de entrada: modo http o stdio
src/
├── platform/                deteccion de SO (macos/windows/linux/wsl) y traduccion de rutas
├── config/                  contrato de variables de entorno
├── shared/                  contratos compartidos (TalendResult, result envelope)
├── domain/                  entidades y puertos del nucleo (jobs, workspace, analysis)
├── application/             casos de uso del nucleo
├── infrastructure/          implementaciones (filesystem, git, xml, workspace)
├── talend/                  logica de Talend: XML, jobs, contextos, DQ, mastery, tools
├── modules/                 modulos con casos de uso y adapters propios
├── presentation/
│   ├── tools/               tools por area (analysis, components, contexts, execution, jobs)
│   └── server/              servidor HTTP/stdio y registro de tools
└── server/                  registro de tools, adaptadores MCP, esquemas
scripts/                     scripts de operacion (start, install-bridge, jobs, contexts, ...)
tests/                       suite de tests (bun test)
talend-studio-bridge/        plugin Java (Eclipse/Tycho) que expone Studio por HTTP
docs/                        documentacion tecnica
```

Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## 6. Como agregar una tool

1. **Implementa el caso de uso** en `src/modules/<modulo>/application/` o en `src/talend/`.
   Nada de logica de negocio dentro del handler de la tool.
2. **Crea el tool** con schema Zod:

   ```typescript
   import { z } from "zod/v4";
   import type { CallToolResult } from "@modelcontextprotocol/server";

   export function createMiTool() {
     return {
       name: "talend_mi_cosa",
       description: "Que hace la tool, en una frase.",
       inputSchema: z.object({}),
       annotations: { readOnly: true },
       handler: async (input): Promise<CallToolResult> => ({
         content: [{ type: "text", text: "..." }],
         structuredContent: { ...payload },
         isError: false,
       }),
     };
   }
   ```

   Ubicacion: `src/modules/<modulo>/tools/` si el modulo existe, `src/talend/studio/tools-<area>.ts`
   si es una tool de estudio.
3. **Registrala**:
   - Tools de modulo: en `getModuleTools()` de `src/server/registered-tools.ts`.
   - Tools de estudio: en el array `allTools` de `src/talend/studio/bridge-tools.ts`.
4. **Escribe el test** en `tests/tools/` o `tests/<area>/`.
5. **Verificacion**: `bun run typecheck` y `bun test`.

Convenciones:

- Nombre: `talend_<area>_<verbo>`. Areas: `jobs`, `components`, `contexts`, `runs`, `errors`,
  `validation`, `secrets`, `snapshots`, `datasets`, `deliverables`, `evidence`, `requirements`,
  `bridge`, `recipe`, `mastery`.
- Marca `readOnly: true` en toda tool que no escriba.
- El `structuredContent` debe llevar el payload en `data` cuando la tool use el envelope
  `TalendResult`; los clientes leen `structuredContent.data`.
- Si la capacidad ya existe, **no** dupliques la tool: renombra la existente o borra la vieja.

## 7. Contrato de resultado

El servidor usa el envelope estandar:

```typescript
{
  ok: boolean,
  source: string,        // tool que produjo el resultado
  confidence: "high" | "medium" | "low" | "none",
  data?: unknown,        // payload
  errors?: Array<{ code: string; message: string; details?: unknown }>,
  warnings?: string[],
  nextActions?: Array<{ label: string; toolName: string; input?: Record<string, unknown> }>,
}
```

`ok`/`fail` viven en `src/presentation/tools/common/response.ts`.
El schema Zod esta en `src/shared/contracts/result.contract.ts`.

## 8. Tests

- Ubicacion: `tests/<area>/<tema>.test.ts`, con `import { describe, expect, test } from "bun:test"`.
- Fixtures: `tests/fixtures/talend/`. No dependas de archivos que existan solo en una maquina.
- Para rutas, crea temporales con `mkdtempSync(join(tmpdir(), "talend-<area>-"))` y borralos en
  `afterAll`.
- `bunfig.toml` limita `bun test` a `tests/` a proposito: no agregues tests fuera de esa carpeta.

Cobertura existente por area:

| Carpeta | Que cubre |
|---|---|
| `tests/tools/` | registro, contratos, schemas, seguridad, convencion de nombres |
| `tests/presentation/` | envelope de resultado |
| `tests/talend/` | jobs, contextos, DQ, logs, workspace, ejecuciones, diagnostico |
| `tests/platform/` | deteccion de SO, portabilidad de rutas |

## 9. Before de tocar codigo

```bash
bun install
bun run typecheck   # debe estar limpio antes de empezar
bun test            # debe estar verde antes de empezar
```

Si alguno de los dos falla antes de tu cambio, el problema es preexistente: reportalo y sigue.
