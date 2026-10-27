# AGENTS.md

Instrucciones para agentes de IA que trabajan en **talend-mcp**.

Este archivo es la fuente de verdad. Si una regla aqui contradice una costumbre tuya, gana este
archivo. `CLAUDE.md` solo guarda el detalle de Bun y apunta aqui. El indice de toda la
documentacion esta en [docs/README.md](docs/README.md).

## 0. Empieza aqui

**talend-mcp** es un servidor MCP local que analiza y edita proyectos de **Qlik Talend Studio**.
Trabaja sobre los archivos del workspace y, cuando Talend Studio esta abierto, con el plugin Java
(`talend-studio-bridge/`) que expone la API del IDE. No tiene interfaz grafica: lo consume un
cliente MCP.

Primeros comandos, en este orden:

```bash
bun install      # una vez
bun run mapa     # mapa vivo: carpetas, tools por preset, comandos y estado del bridge
bun run doctor   # Studio, bridge, MCP y configuracion en una pantalla
bun test         # debe estar en verde antes de tocar nada
```

**Elige tu camino:**

| Quieres... | Empieza por | Verifica con |
|---|---|---|
| **Usar** el MCP para crear, editar o ejecutar jobs en Studio | [docs/GUIA-AGENTE.md](docs/GUIA-AGENTE.md). En el cliente MCP, la primera llamada es `talend_guide` con `mode: "overview"` | la guia y `talend_guide` |
| **Cambiar** codigo TypeScript (tools, servicios, scripts) | Seccion 5 y [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | `bun run typecheck` y `bun test tests/<area>` |
| **Agregar una tool** MCP | Seccion 6 y [docs/PLAN-DE-TRABAJO.md](docs/PLAN-DE-TRABAJO.md) | `bun test tests/tools` |
| **Cambiar el plugin Java** (bridge) | [talend-studio-bridge/README.md](talend-studio-bridge/README.md) y seccion 3 | `bun test tests/talend/bridge-java.test.ts` |
| **Escribir o revisar** un escenario L5 | [docs/plan-de-pruebas/03-ejecucion-l5.md](docs/plan-de-pruebas/03-ejecucion-l5.md) | `bun run l5:validar` |
| **Entender** una API interna de Talend Studio | [docs/TALEND-STUDIO-INTERNALS.md](docs/TALEND-STUDIO-INTERNALS.md) y `bun run talend:api find <nombre>` | `bun run talend:api live <clase>` |
| Saber **que esta probado** | [docs/COBERTURA-POR-FAMILIA.md](docs/COBERTURA-POR-FAMILIA.md) | `bun run mapa` |
| **No sabes donde esta algo** | [docs/README.md](docs/README.md) | `bun run mapa` |

**Verifica siempre con `talend_job_verify`.** Un job puede ejecutarse "bien" y llevar avisos. Tras
crear o cambiar un job, una sola llamada, `talend_job_verify { job }`, revisa el diseno (vista
Problemas), compila, ejecuta y busca `[WARN]`, `[ERROR]`, `[FATAL]` y excepciones **aunque el
codigo de salida sea 0**. Devuelve `verdict` (`ok`, `ok_con_avisos`, `error`) y `findings`: informa
de cada aviso al usuario. Para el detalle: `talend_tail_run_output` (stderr), `talend_analyze_logs` y `talend_bridge_log_tail` (Error Log de
Studio). `talend_job_problems`, `talend_job_compile`, `talend_job_run_by_name` y
`talend_job_wait_run` siguen existiendo pero solo con `TALEND_MCP_FILTER=all`: `verify` ya los
encadena. `talend_job_execute` tambien devuelve `findings`. En el arnes L5 se hace solo
(`src/talend/diagnostics/output-findings.ts`): un `[ERROR]` o un error de diseno con el job
terminado hace fallar el escenario, y los avisos salen en el informe. Lo esperado se declara en
`espera.avisos_tolerados`.

**Tres reglas que mas dano hacen:**

1. **Los jobs se crean y modifican con las tools que usan la API de Studio** (`talend_job_*_in_studio`,
   `talend_job_add_node`...), nunca escribiendo el `.item` a mano. Studio mantiene el modelo en
   memoria: un XML escrito por fuera deja el job inconsistente.
2. **Studio es un entorno vivo.** `bun run bridge:install` recarga el plugin en el Studio abierto:
   no lo ejecutes mientras hay jobs o dialogos en curso. Las acciones con `unsafeActions`
   (ejecutar codigo Java, borrar, escribir en el workspace) pueden ser irreversibles.
3. **Antes de commitear:** `bun run verify`. No commitees carpetas generadas (seccion 10).

## 1. Que es el repo

El servidor expone decenas de herramientas MCP, agrupadas por area (`talend_<area>_<verbo>`).
`bun run mapa` da el numero exacto por preset: un cliente externo nuevo usa
`TALEND_MCP_FILTER=agent`; `all` expone todo.

Regla de fondo para quien usa el MCP: los jobs se crean y modifican **con la API de Studio**, nunca
escribiendo el `.item` a mano (ver regla 1 arriba).

## 2. Stack y comandos

| Comando | Que hace |
|---|---|
| `bun install` | Instala dependencias. **Nunca** uses npm, yarn o pnpm. |
| `bun test` | Suite completa, en segundos. Solo corre `tests/` (lo fija `bunfig.toml`). |
| `bun run typecheck` | `tsc --noEmit`. Debe terminar sin errores. |
| `bun run verify` | `typecheck` + `bun test` + `l5:validar`. Es el comando antes de commitear. |
| `bun run test:ci` | `bun test --bail`: corta en el primer fallo. |
| `bun run l5:validar` | Valida los escenarios L5 sin abrir Studio ni cargar el bridge. Acepta `--suite <nombre>`. |
| `bun run mapa` | Mapa del repo: carpetas, tools por preset, comandos y estado del bridge. `--json` para scripts. |
| `bun run doctor` | Estado de Studio, bridge, MCP y configuracion en una pantalla. |
| `bun run start:server` | Levanta el servidor MCP en `http://127.0.0.1:3927/mcp`, con todas las tools. |
| `bun run start` | Igual, con preset `agent` por defecto, y actualiza el plugin si Studio esta abierto y el bridge no responde. |
| `bun run bridge:install` | Compila y publica el plugin Java. Con Studio abierto compila con `javac` y recarga en caliente. `--maven` fuerza Maven/Tycho (lento); `--force` recompila aunque no haya cambios. |
| `bun run bridge:status` | Estado del bridge: Studio, version en vivo, build local y jar publicado. Solo lee. |
| `bun run bridge:watch` | Desarrollo del plugin: recompila y recarga al guardar un fuente, con Studio abierto. |
| `bun run talend:api <drift\|find\|live>` | Examina la API de Talend: nombres que la instalacion no tiene, clases que declaran un nombre, y consultas al Studio abierto. |
| `bun run jobs ...` / `bun run contexts ...` | CLI local para jobs y contextos. |

Reglas de Bun (proyecto, no Node):

- `bun <file>` en vez de `node <file>` o `ts-node`.
- `bun test` en vez de `jest` o `vitest`.
- `bun run <script>` en vez de `npm run <script>`.
- `bunx <pkg>` en vez de `npx <pkg>`.
- Bun carga `.env` solo: no agregues `dotenv`.
- `Bun.serve()`, `Bun.file()`, `bun:sqlite`, `Bun.$` ya estan disponibles.

## 3. Estado del repositorio

- **No hay apps ni UI.** La capa de interfaz grafica ya no existe: el servidor expone solo tools.
- **No hay tunel ni exposicion publica.** El servidor es local (`127.0.0.1`) o stdio. No
  reintroduzcas claves de control plane, tuneles ni la capa de Tailscale.
- **No hay aliases de tools.** Toda tool se llama `talend_<area>_<verbo>` y hay una sola tool
  por capacidad. No reintentes el mecanismo de aliases legacy.
- **El registro de tools vive en un solo lugar:** `getModuleTools()` en
  `src/server/registered-tools.ts`, que consume `src/presentation/server/tool-registry.ts`.
- **No hay codigo muerto.** Si agregas un archivo, conectalo: los barridos de referencias
  orfas son parte de la revision.
- **El plugin Java se recarga en caliente.** `bun run bridge:install` publica el bundle en
  `~/.talend-bridge/hot/bridge.jar` y el plugin lo detecta y se recarga solo (`Bundle.update`).
  No reinicies Talend Studio para aplicar cambios. Ojo: al reiniciar Studio se carga el bundle
  **instalado**, no el de la carga en caliente; despues de un reinicio hay que volver a lanzar
  `bun run bridge:install` y mirar la `version` del ping.
- **Nada lento ni bloqueante en el hilo de UI del bridge.** `UiThread.sync` es solo para tocar
  widgets o el modelo del job, y en trozos cortos. Ejecutar jobs, descargar artefactos, recorrer
  el catalogo entero o esperar procesos va en el hilo de trabajo HTTP; si no, Talend Studio se
  congela. Detalle en `docs/TALEND-STUDIO-INTERNALS.md` seccion 26.
- **Probar Java sin recompilar el bridge:** `talend_studio_run_code` ejecuta Java dentro de Studio
  (requiere `unsafeActions`). Usalo para explorar APIs; lo que funcione se lleva al bridge como
  operacion con su tool, para que quien clone el repo la tenga.
- **Documenta lo que aprendas.** Cada trampa de Studio descubierta va a
  `docs/TALEND-STUDIO-INTERNALS.md`; cada limite o estado de fase, a `docs/plan-de-pruebas/`.

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
8. **Archivos pequenos, una responsabilidad.** Si un archivo se acerca a 300 lineas, separalo por
   responsabilidad (no por numero de lineas) y conserva una fachada con los exports que ya se
   usaban. Los CLI comparten `src/shared/cli/ui.ts`; no dupliques helpers de color o iconos.
9. **Fixtures granulares.** Los escenarios L5 viven en
   `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`: un archivo por escenario,
   agrupados en la carpeta de su suite. Se cargan y validan con `scripts/l5/scenario-files.ts`
   (`loadScenarioTree`), y `bun run l5:validar` los revisa sin abrir Studio. No vuelvas a un
   unico JSON gigante ni a un archivo por suite.
10. **Documentacion por tema.** `docs/TALEND-STUDIO-INTERNALS.md`, `docs/GUIA-AGENTE.md` y
    `docs/plan-de-pruebas/` son indices; el contenido vive en `docs/studio-internals/`,
    `docs/guia-agente/` y `docs/plan-de-pruebas/`. No agregues secciones nuevas al indice: crea o
    amplia el archivo del tema y conserva el numero de seccion cuando exista.
11. **Variables de entorno nuevas** se declaran en `src/config/env.ts` y se documentan en el
    README. Las del CLI instalador son `TALEND_STUDIO_HOME`, `TALEND_BRIDGE_AUTO_INSTALL` y
    `TALEND_MCP_LOG`.
12. **Rutas de datos de los escenarios.** En un escenario L5, `@TESTDATA@` se sustituye solo a
    traves del arnes (`scripts/l5/testdata-paths.ts`). Si llamas al bridge a mano, usa la ruta
    absoluta: un placeholder sin sustituir hace que Studio escriba en una carpeta literal.
13. **Documentacion que se puede romper, se comprueba.** `tests/docs/entry-docs.test.ts` verifica
    enlaces, comandos `bun run` y rutas de los mapas. Si mueves algo, el test te dice que arreglar.

## 5. Estructura del repositorio

```
index.ts                     punto de entrada: modo http o stdio
src/
├── platform/                deteccion de SO (macos/windows/linux/wsl) y traduccion de rutas
├── config/                  contrato de variables de entorno
├── shared/                  contratos compartidos y utilidades (TalendResult, cli/ui)
├── domain/                  entidades y puertos del nucleo (jobs, workspace, analysis)
├── application/             casos de uso del nucleo
├── infrastructure/          implementaciones (filesystem, git, xml, workspace)
├── talend/                  logica de Talend: XML, jobs, contextos, DQ, mastery, tools de Studio
├── modules/                 modulos con casos de uso y adapters propios (jobs, runs, guide, studio-bridge...)
├── presentation/
│   ├── tools/               tools por area (analysis, components, contexts, execution, jobs)
│   └── server/              servidor HTTP/stdio, registro y anotaciones de tools
└── server/                  registro de tools, adaptadores MCP, presets y esquemas
scripts/                     scripts de operacion (start, install-bridge, doctor, mapa, jobs, ...)
├── lib/                     deteccion de Studio, compilacion, hot reload, estado e instalacion p2
├── l5/                      arnes L5: validacion, seleccion, montaje, ejecucion y expectativas
├── talend-api/              detector de deriva de la API de Talend (ApiDrift.java)
├── studio-job/              una fase por archivo para el CLI de operaciones sobre Studio
└── testdata/                generadores de CSV, XLSX (ZIP) y datos de Postgres
tests/                       suite de bun test (un area por carpeta, ver seccion 8)
talend-studio-bridge/        plugin Java (Eclipse/Tycho) que expone Studio por HTTP
docs/                        documentacion tecnica; indice en docs/README.md
```

`bun run mapa` muestra la misma estructura con una descripcion de cada carpeta y el estado real del
bridge. Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Las APIs internas de
Talend Studio que usa el plugin estan en
[docs/TALEND-STUDIO-INTERNALS.md](docs/TALEND-STUDIO-INTERNALS.md).

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
   si es una tool de Studio.
3. **Registrala**:
   - Tools de modulo: en `getModuleTools()` de `src/server/registered-tools.ts`.
   - Tools de Studio: en el array `allTools` de `src/talend/studio/bridge-tools.ts`.
4. **Escribe el test** en `tests/tools/` o `tests/<area>/`.
5. **Verificacion**: `bun run typecheck` y `bun test`. Luego `bun run docs:tools` regenera el
   catalogo y `bun run mapa` debe contar la tool nueva.

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
- Un solo archivo se corre con `bun test tests/<area>/<tema>.test.ts`; una carpeta, con
  `bun test tests/<area>`. No hace falta correr la suite completa mientras se itera.
- Fixtures: `tests/fixtures/talend/`. No dependas de archivos que existan solo en una maquina.
- Para rutas, crea temporales con `mkdtempSync(join(tmpdir(), "talend-<area>-"))` y borralos en
  `afterAll`.
- `bunfig.toml` limita `bun test` a `tests/` a proposito: no agregues tests fuera de esa carpeta.

Cobertura por area:

| Carpeta | Que cubre |
|---|---|
| `tests/tools/` | registro, contratos, schemas, seguridad, convencion de nombres |
| `tests/presentation/` | envelope de resultado |
| `tests/talend/` | jobs, contextos, DQ, logs, workspace, ejecuciones, diagnostico, y el bridge |
| `tests/talend/bridge-java.test.ts` | tests Java del plugin (compila `talend-studio-bridge/.../test/` con el JDK de Studio; se salta sin Studio) |
| `tests/l5/` | arnes L5: rutas de datos, seleccion y montaje de escenarios |
| `tests/scripts/` | scripts de operacion: instalador, estado del bridge, mapa, CLI de la API de Talend |
| `tests/docs/` | documentacion de entrada: enlaces, comandos y rutas de los mapas |
| `tests/platform/` | deteccion de SO, portabilidad de rutas |

## 9. Antes de tocar codigo

```bash
bun install
bun run typecheck   # debe estar limpio antes de empezar
bun test            # debe estar verde antes de empezar
```

Si alguno de los dos falla antes de tu cambio, el problema es preexistente: reportalo y sigue.

## 10. Carpetas que no se versionan, y de quien son

| Carpeta | De quien es | Que hacer |
|---|---|---|
| `workspace/` | Talend Studio (Eclipse), local | No la edites ni la versiones. Ignorada. |
| `node_modules/`, `talend-studio-bridge/**/target/` | bun y el build del plugin | Se regeneran. Ignoradas. |
| `.talend-mcp/` | runtime del servidor (catalogos, logs de runs) | Ignorada. Se regenera. |
| `entregables/`, `evidencias/` | salidas generadas | Ignoradas. |
| `testdata/*.csv`, `testdata/*.xlsx`, ... | datos de prueba generados por `scripts/make-testdata.ts` | Se regeneran; los pequenos si estan versionados. |
| `.freebuff/` | otra herramienta, con su `project-id` | Ignorada. No la edites. |
| `addons/` | datos de sinonimos, **sin uso confirmado** en el codigo | Versionada. No la borres sin decidirlo con el equipo. |
| `examples/` | ejemplos de entrada | Versionada. Solo referencia. |

Una carpeta nueva que aparezca sola en la raiz, con un nombre raro, es un error de alguna
ejecucion: busca quien la creo antes de commitearla. Si aparece `@TESTDATA@`, un escenario L5 no
sustituyo su placeholder (regla 12).
