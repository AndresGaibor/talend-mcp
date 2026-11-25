# Plan de producción de talend-mcp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las brechas que separan a talend-mcp 0.1.1 de un MCP fiable y verificable en producción: diagnóstico de fallos, prueba del binario publicado, vía en vivo con Studio estable, evidencia de utilidad con un asistente real, actualización guiada y gobernanza.

**Architecture:** Siete fases independientes entre sí salvo donde se indica. Cada una deja el repositorio en verde y publicable. Lo que se puede construir sin Studio (A, B, E, F, G) va primero; lo que exige medir contra Studio (C) y contra un asistente real (D) usa herramientas construidas antes.

**Tech Stack:** Bun + TypeScript, `bun test`, GitHub Actions, binarios compilados con `bun build --compile`, PowerShell y sh para los instaladores.

**Spec:** No hay documento de diseño aparte: la fuente es la evaluación de brechas del 19/11/2026, resumida en «Contexto». Los números salen de `.talend-mcp/audit.jsonl` (4155 llamadas, 4 al 18 de noviembre).

## Contexto

| # | Brecha | Evidencia |
|---|---|---|
| 1 | Vía en vivo frágil | `talend_bridge_refresh_workspace` 108 fallos de 826 (13%); `talend_job_create_in_studio` 11 de 14 el 17/11; `talend_job_connect_nodes` hasta 108 s con el diálogo «Se está a la espera de una intervención del usuario»; una llamada de 9,6 h |
| 2 | Fallos sin causa | El audit guarda `TOOL_RESULT_ERROR` y nada más; no rota |
| 3 | Sin evidencia de utilidad | Ninguna evaluación con un asistente real; la prueba C9 del plan de pruebas sigue pendiente |
| 4 | Binario sin probar | El CI ejecuta tests con Bun, nunca el ejecutable publicado |
| 5 | Un solo entorno | Solo Studio 8.0.1 en Windows; el workflow de Studio en vivo está apagado (`STUDIO_ENABLED`) |
| 6 | Cadena de suministro | Binarios sin firma ni attestations; el checksum viaja en el mismo release |
| 7 | Sin actualización guiada | Actualizar es repetir el instalador |
| 8 | Superficie de tools | Unas 56 tools de `all` con riesgo y `readOnlyHint` incoherentes; sin medir el coste de `tools/list` |
| 9 | Gobernanza | Sin protección de rama; el historial de git conserva un correo corporativo y un nombre de proyecto de cliente |

## Global Constraints

- Bun, no Node. Sin `dotenv`. Mensajes y documentación en español. Pruebas con `bun test`.
- **Antes de cada commit:** hacer `git add` de exactamente lo que se commitea, ejecutar `bun run verify` y commitear. La huella del gancho pre-commit incluye el estado de staging: verificar con otro staging invalida el cierre.
- `src/modules/studio-bridge/adapters/bridge-transport.ts` y `src/talend/studio/tools-job-operations/job-lifecycle.ts` tienen cambios sin commitear del propietario. La tarea que los toca (T7) empieza integrando o commiteando ese trabajo con su autor, nunca pisándolo.
- Las pruebas no escriben en el `.talend-mcp/audit.jsonl` real: `tests/setup.ts` fija `TALEND_MCP_LOG=quiet`; un test que audite lo pone en `normal` dentro de un directorio temporal.
- Todo `bun run <nombre>` citado en documentación debe existir en `package.json` (`tests/docs/entry-docs.test.ts`). Para scripts nuevos se cita `bun scripts/<archivo>.ts`.
- Subir la versión a la vez en `package.json`, `plugins/talend-mcp/.claude-plugin/plugin.json` y `.claude-plugin/marketplace.json`; anotar en `CHANGELOG.md` (`tests/docs/distribution.test.ts` lo exige).
- **No crear tags ni releases, ni tocar la configuración de GitHub, sin aprobación expresa del propietario** para cada acción. Las acciones de GitHub se listan en la fase H.
- Los tests con rutas de Windows usan `String.raw` (las barras invertidas en literales normales se pierden).
- Una prueba de PowerShell que cambie `USERPROFILE` se ejecuta desde fuera del repo (deja `Microsoft/` en el directorio actual y rompe `tests/scripts/mapa.test.ts`).

## Review Focus

1. **Secretos en los mensajes del audit:** un error con `token=abc123` o una ruta con usuario no debe persistir tal cual. Test en T1.
2. **`talend-mcp update` con el ejecutable en uso:** en Windows no se puede sobrescribir un `.exe` abierto por un cliente MCP; debe fallar con un mensaje claro y sin dejar un binario a medias. Test en T10.
3. **Smoke sin Studio:** en un runner sin Studio, las tools que necesitan el bridge deben devolver un error en menos de 15 s, no colgarse. Test en T3.
4. **Evaluación sin la CLI `claude`:** el runner debe saltarse con un mensaje, no fallar. Test en T9.
5. **Audit corrupto o vacío:** `talend-mcp audit` con líneas que no son JSON o con un archivo inexistente no debe lanzar. Test en T2.

---

## Fase A: Diagnóstico

### Task 1: El audit guarda la causa del fallo y rota

**Files:**
- Modify: `src/presentation/server/tool-auth.ts` (`auditToolCall`, nueva `sanitizeAuditMessage`, nueva `rotateAudit`), `src/presentation/server/new-server/dispatch.ts` (nueva `mensajeDeFallo`), `src/config/env.ts` (variable nueva)
- Modify: `docs/CONFIGURACION.md` (fila de la variable), `SECURITY.md` (el audit guarda un mensaje truncado y saneado)
- Test: `tests/presentation/audit.test.ts` (nuevo)

**Interfaces:**
- Produces: `auditToolCall(toolName, risk, ok, detail?, metadata: { durationMs?, correlationId?, operationId?, message? })`; `sanitizeAuditMessage(text: string): string`; `rotateAudit(dir: string, maxBytes: number, keep: number): void`; `mensajeDeFallo(resultado: unknown): string | undefined`. Variable `TALEND_MCP_AUDIT_MAX_BYTES` (entero positivo, por defecto 5242880).

- [ ] **Step 1: Tests que fallan** en `tests/presentation/audit.test.ts`: `sanitizeAuditMessage recorta a 300 caracteres y quita saltos de línea`; `sanitizeAuditMessage oculta token, password, secret, authorization y api key` (entrada `"fallo token=abc123 y password: xyz"` → no contiene `abc123` ni `xyz`); `auditToolCall escribe message y nunca la entrada`; `rotateAudit renombra a audit.1.jsonl al superar el tope y conserva como mucho keep archivos`.
- [ ] **Step 2:** `bun test tests/presentation/audit.test.ts` → FALLA (funciones no definidas).
- [ ] **Step 3: Implementar.** `mensajeDeFallo` toma `errors[0].message` del envelope o el primer `content[].text` cuando `isError`. `auditToolCall` añade `message` saneado al registro y llama a `rotateAudit(dir, TALEND_MCP_AUDIT_MAX_BYTES, 3)` antes de escribir. `dispatchValidated` pasa `mensajeDeFallo(result)` en el caso `TOOL_RESULT_ERROR`.
- [ ] **Step 4:** `bun test tests/presentation tests/platform/env-contract.test.ts` → PASA (el contrato de entorno exige la fila en `docs/CONFIGURACION.md`).
- [ ] **Step 5: Commit** `feat(audit): guarda la causa del fallo y rota el archivo`.

### Task 2: `talend-mcp audit` resume la salud de las tools

**Files:**
- Create: `src/cli/audit-command.ts`
- Modify: `src/cli/main.ts` (grupo `audit`, opciones `--failures`, `--tail`), `docs/CLI.md`
- Test: `tests/cli/audit-command.test.ts`

**Interfaces:**
- Consumes: formato del registro de T1.
- Produces: `summarizeAudit(lines: string[]): ToolHealth[]` con `ToolHealth = { tool: string; calls: number; failures: number; failureRate: number; p50Ms: number; p95Ms: number; topErrors: { detail: string; count: number }[] }`; `runAuditCommand(opts: { failures: boolean; tail?: number }): number`.

- [ ] **Step 1: Tests** `summarizeAudit agrupa por tool y calcula tasa de fallo y p95`; `summarizeAudit ignora líneas que no son JSON` (Review Focus 5); `runAuditCommand devuelve 0 y avisa si no existe audit.jsonl`.
- [ ] **Step 2:** ejecutar → FALLA.
- [ ] **Step 3: Implementar** leyendo `audit.jsonl` y `audit.1.jsonl` del directorio de estado; con `--failures` solo tools con `failures > 0`, ordenadas por tasa; con `--tail n` las últimas n entradas con su `message`.
- [ ] **Step 4:** `bun test tests/cli/audit-command.test.ts` → PASA. Comprobar a mano que `bun run cli audit --failures` reproduce los números del Contexto.
- [ ] **Step 5: Commit** `feat(cli): talend-mcp audit resume fallos y latencias`.

## Fase B: Probar lo que se publica

### Task 3: Prueba de humo reutilizable

**Files:**
- Create: `scripts/lib/smoke.ts`, `scripts/smoke-binary.ts`
- Test: `tests/scripts/smoke.test.ts`

**Interfaces:**
- Produces: `smokeTest(cmd: string[], opts?: { timeoutMs?: number }): Promise<SmokeReport>` con `SmokeReport = { version: string; toolCount: number; guideOk: boolean; pingMs: number; stateInHome: boolean }`. Lanza `Error` con la causa si algo no cumple.

- [ ] **Step 1: Test** `smokeTest contra el servidor desde el código fuente` (`["bun", "src/cli/main.ts", "serve"]`) con `TALEND_MCP_HOME` temporal: `version === VERSION`, `toolCount >= 25`, `guideOk`, `stateInHome` (el estado está en el HOME temporal y no en el directorio actual), y `pingMs < 15000` aunque no haya Studio (Review Focus 3). Segundo test: `smokeTest falla si stdout contiene algo que no es JSON-RPC` con un comando que imprime texto.
- [ ] **Step 2:** ejecutar → FALLA.
- [ ] **Step 3: Implementar** el protocolo `initialize`, `notifications/initialized`, `tools/list`, `tools/call talend_guide {mode:"overview"}` y `tools/call talend_bridge_ping`, leyendo línea a línea; `scripts/smoke-binary.ts <binario>` imprime el informe y sale con 1 si falla.
- [ ] **Step 4:** `bun test tests/scripts/smoke.test.ts` → PASA. Localmente: `bun scripts/smoke-binary.ts dist/talend-mcp-windows-x64.exe` tras `bun run release:build windows-x64`.
- [ ] **Step 5: Commit** `test: prueba de humo del servidor y del binario`.

### Task 4: El release no publica sin probar el binario y deja attestations

**Files:**
- Modify: `.github/workflows/release.yml`, `SECURITY.md` (cómo verificar con `gh attestation verify`)
- Test: `tests/docs/release-workflow.test.ts`

- [ ] **Step 1: Test** que parsea el YAML (`Bun.YAML.parse`): `el job publish depende de smoke`; `smoke corre en ubuntu, windows y macos`; `los permisos incluyen id-token y attestations`; `publish solo corre en tags`.
- [ ] **Step 2:** ejecutar → FALLA.
- [ ] **Step 3: Implementar** un job `smoke` con matriz (`ubuntu-latest` → `talend-mcp-linux-x64`, `windows-latest` → `talend-mcp-windows-x64.exe`, `macos-latest` → `talend-mcp-darwin-arm64`) que descarga el artefacto `binaries` y ejecuta `bun scripts/smoke-binary.ts`. El binario `darwin-x64` no se ejecuta (no hay runner Intel): queda documentado en `SECURITY.md`. Añadir `actions/attest-build-provenance` sobre `dist/*` en `publish`.
- [ ] **Step 4:** `bun test tests/docs` → PASA. Verificación real tras la fase: disparo manual (`gh workflow run release.yml`) y comprobar que `smoke` corre en los tres sistemas.
- [ ] **Step 5: Commit** `ci(release): prueba de humo por plataforma y attestations`.

## Fase C: Vía en vivo con Studio (necesita Studio y al propietario delante)

Criterio de salida: sobre 100 ejecuciones consecutivas, `talend_bridge_refresh_workspace` acierta al menos el 99% con p95 inferior a 15 s, y toda llamada bloqueada por un diálogo falla en 30 s o menos con un error que nombra el diálogo.

### Task 5: Medir antes de arreglar

**Files:**
- Create: `scripts/live-reliability.ts`
- Modify: `docs/PERFORMANCE.md` (resultados)
- Test: `tests/scripts/live-reliability.test.ts` (solo la parte pura)

**Interfaces:**
- Consumes: `summarizeAudit` (T2).
- Produces: `bun scripts/live-reliability.ts --tool <nombre> --calls <n> [--input <json>]` escribe `.talend-mcp/reliability/<fecha>.csv` (`n, ok, ms, code, message`) y un resumen; `percentile(values: number[], p: number): number`.

- [ ] **Step 1: Test** `percentile calcula p50 y p95` y `el resumen cuenta fallos por mensaje`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3: Implementar** el script llamando al servidor stdio como el smoke de T3. **Step 4:** tests PASAN.
- [ ] **Step 5: Medir con Studio abierto** (el propietario presente): 100 llamadas a `talend_bridge_refresh_workspace`, 30 a `talend_job_create_in_studio` con `replace: true`, 30 ciclos `add_node` + `connect_nodes`. Registrar tasa, p50, p95 y los tres mensajes de error más frecuentes en `docs/PERFORMANCE.md`.
- [ ] **Step 6: Commit** `test: arnés de fiabilidad de la vía en vivo` y `docs: medición de fiabilidad`.

### Task 6: Esperar a Studio en vez de pulsar o colgarse

**Files:**
- Modify: `src/talend/studio/modals/modal-policy.ts`, `src/talend/studio/modals/modal-types.ts` (leerlos antes de editar)
- Test: `tests/talend/modal-policy.test.ts` (existente: añadir casos)

**Interfaces:**
- Produces: una regla `esperando-trabajo-en-segundo-plano` que clasifica como espera, sin pulsar ningún botón, el diálogo titulado «Se está a la espera de una intervención del usuario» (botón «Cancelar intervención del usuario» incluido). Hoy se registra como `unknown` y se deja abierto; la diferencia es que el cliente del bridge sabe que debe esperar.

- [ ] **Step 1: Tests** con los textos reales de `logs/modales.jsonl`: `no pulsa Cancelar intervención del usuario`; `lo clasifica como espera` ; `un diálogo con campos editables sigue sin respuesta automática`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3:** añadir la regla y el tipo de decisión necesario. **Step 4:** `bun test tests/talend` → PASA. **Step 5: Commit** `fix(studio): un diálogo de espera no se cancela`.

### Task 7: Fallar rápido con una causa legible

**Files:**
- Modify: `src/modules/studio-bridge/adapters/bridge-transport.ts` (**ver Global Constraints**), `docs/SOLUCION-DE-PROBLEMAS.md`
- Test: `tests/talend/bridge-transport-errors.test.ts` (existente: añadir casos)

**Interfaces:**
- Produces: código de error `STUDIO_BUSY` con `message` que nombra el diálogo detectado y `nextActions` con el paso a seguir; el presupuesto total de reintentos por llamada queda en 30 s (configurable con `TALEND_BRIDGE_BUSY_BUDGET_MS`).

- [ ] **Step 1: Tests** `con un diálogo de espera abierto devuelve STUDIO_BUSY en menos del presupuesto`; `sin diálogo, un timeout sigue reintentando una vez`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3:** implementar usando la clasificación de T6. **Step 4:** PASA y repetir la medición de T5 para comparar. **Step 5: Commit** `fix(bridge): STUDIO_BUSY en 30 s con el diálogo que bloquea`.

### Task 8: Entorno declarado y avisado

**Files:**
- Modify: `src/presentation/tools/studio/diagnose-environment.tool.ts` (campo `studio.version` y `studio.tested: boolean`), `docs/INSTALACION-CLIENTES.md` (tabla de compatibilidad)
- Test: `tests/presentation/diagnose-environment.test.ts` (nuevo)

- [ ] **Step 1: Test** `studio.tested es true solo para 8.0.1` y `un Studio 7.3 produce un aviso, no un error`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3:** leer la versión de Studio de su instalación y compararla con la lista `TESTED_STUDIO_VERSIONS = ["8.0.1"]`. **Step 4:** PASA. **Step 5: Commit** `feat(doctor): avisa de versiones de Studio no probadas`.

## Fase D: Evidencia de utilidad

### Task 9: Escenarios y medidor de contexto

**Files:**
- Create: `evals/scenarios/*.json` (cinco), `scripts/evals/run.ts`, `scripts/measure-tools-list.ts`, `docs/EVALUACION.md`
- Test: `tests/scripts/evals.test.ts`

**Interfaces:**
- Produces: escenario `{ id: string; prompt: string; fixture: string; assertions: { kind: "job-exists" | "job-has-component" | "verify-verdict"; job?: string; component?: string; verdict?: string }[] }`; `evaluateScenario(scenario, projectDir): { passed: boolean; failed: string[] }`; `bun scripts/measure-tools-list.ts` imprime bytes y tokens estimados (caracteres / 4) del preset `agent`.

Escenarios: listar los jobs que usan `tMap`; crear un job CSV → filtro → CSV (offline, `talend_jobs_create_from_spec`); cambiar un parámetro de un job existente; renombrar un contexto en 20 jobs (`talend_jobs_edit_batch`); diagnosticar un job con avisos (`talend_job_verify`).

- [ ] **Step 1: Tests** `evaluateScenario aprueba cuando el job y el componente existen`; `evaluateScenario lista cada aserción fallida`; `el runner se salta con un mensaje si no existe el comando claude` (Review Focus 4).
- [ ] **Step 2:** ejecutar → FALLA. **Step 3: Implementar.** El runner copia el proyecto de `tests/fixtures/talend` a un directorio temporal y ejecuta `claude -p "<prompt>" --mcp-config <json temporal> --allowedTools "mcp__talend-mcp__*" --output-format json` con `TALEND_PROJECT` apuntando a la copia; después evalúa las aserciones con las funciones de lectura del propio servidor.
- [ ] **Step 4:** `bun test tests/scripts/evals.test.ts` → PASA.
- [ ] **Step 5: Ejecución real** (3 repeticiones por escenario, con la sesión del propietario): registrar en `docs/EVALUACION.md` tasa de éxito, llamadas por tarea y tokens. **Criterio de salida:** al menos 12 de 15 ejecuciones correctas y `tools/list` del preset `agent` por debajo de 12000 tokens estimados. Lo que falle se corrige en la descripción de la tool o en `talend_guide`, con un test por corrección.
- [ ] **Step 6: Commit** `test(evals): escenarios con un asistente real y medida de contexto`.

## Fase E: Actualización

### Task 10: `talend-mcp update`

**Files:**
- Create: `src/cli/update-command.ts`
- Modify: `src/cli/main.ts`, `docs/CLI.md`, `docs/INSTALACION-CLIENTES.md`
- Test: `tests/cli/update-command.test.ts`

**Interfaces:**
- Produces: `compareVersions(a: string, b: string): -1 | 0 | 1` (semver sin prerelease); `assetNameFor(platform: NodeJS.Platform, arch: string): string` (`talend-mcp-windows-x64.exe`, `talend-mcp-linux-x64`, `talend-mcp-darwin-arm64`, `talend-mcp-darwin-x64`); `runUpdateCommand(opts: { check: boolean }): Promise<number>`.

- [ ] **Step 1: Tests** `compareVersions ordena 0.1.1 < 0.1.10 < 0.2.0`; `assetNameFor devuelve el nombre de cada plataforma`; `reemplazar un ejecutable en uso falla con un mensaje claro y deja el original intacto` (Review Focus 2, con un archivo bloqueado simulado); `--check no descarga nada`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3: Implementar** consultando `https://api.github.com/repos/AndresGaibor/talend-mcp/releases/latest`, descargando el asset y `checksums.txt` (misma verificación que `verifyChecksum` de `src/cli/bridge-command.ts`) y reemplazando con rename: el ejecutable actual pasa a `.old`, el nuevo ocupa su sitio; si el segundo paso falla, se restaura el `.old`.
- [ ] **Step 4:** PASA. **Step 5: Commit** `feat(cli): talend-mcp update`.

## Fase F: Superficie de tools

### Task 11: Riesgo y anotaciones coherentes en todo el catálogo

**Files:**
- Modify: `src/presentation/server/tool-safety.ts`, `tests/tools/tool-conformance.test.ts`

- [ ] **Step 1: Ampliar el test** `en el preset agent, el riesgo de lectura y readOnlyHint publicado coinciden` a todas las tools (`getAllRuntimeTools()`), con el título `en todas las tools, riesgo y readOnlyHint coinciden`.
- [ ] **Step 2:** ejecutar → FALLA y lista las unas 56 tools incoherentes.
- [ ] **Step 3: Clasificar** cada una: leer su handler; si no escribe en disco ni llama a un endpoint de escritura del bridge, añadir su entrada a `TOOL_SAFETY` con `readOnlyHint: true`; si escribe, queda como `write`. Sin heurística por nombre.
- [ ] **Step 4:** PASA y `bun run docs:tools` regenera el catálogo. **Step 5: Commit** `fix(tools): riesgo explícito para las tools que lo derivaban por nombre`.

## Fase G: Instalación

### Task 12: Detección de clientes más estricta

**Files:**
- Modify: `src/cli/client-setup.ts` (`isInstalled`), `src/cli/setup-command.ts`
- Test: `tests/cli/client-setup.test.ts`

**Interfaces:**
- Produces: `isInstalled(id, dirs, which)` exige carpeta de configuración **y** el ejecutable del cliente en el PATH para `codex`, `gemini`, `copilot` y `cursor`; Claude Desktop y VS Code siguen por carpeta (no tienen comando estándar). Con `--client` explícito no se comprueba nada.

- [ ] **Step 1: Tests** `codex con carpeta y sin comando no se detecta` y `con --client codex se configura igualmente`.
- [ ] **Step 2:** ejecutar → FALLA. **Step 3:** implementar. **Step 4:** PASA. **Step 5: Commit** `fix(setup): no configura clientes que no están instalados`.

### Task 13: Prueba real de p2 sobre una copia de Studio

**Files:**
- Create: `docs/VALIDACION-CLIENTES.md` (lista de comprobación y tabla de resultados)

- [ ] **Step 1: Comprobar que es seguro.** Copiar la instalación sin los workspaces (`robocopy C:\Talend\8.0.1\studio <destino> /E /XD workspace workspace3`) y buscar en `<destino>\configuration` y `<destino>\p2` rutas absolutas hacia `C:\Talend\8.0.1\studio`. Si hay alguna, parar: la copia modificaría la original.
- [ ] **Step 2:** con `TALEND_STUDIO_HOME=<destino>` y Studio real cerrado, ejecutar `talend-mcp bridge install` y comprobar la versión instalada en `<destino>\features`.
- [ ] **Step 3: Verificar** que `C:\Talend\8.0.1\studio\features` no cambió (misma lista y fechas).
- [ ] **Step 4:** rellenar en `docs/VALIDACION-CLIENTES.md` el resultado y, para Claude Desktop, VS Code, Copilot CLI, Cursor, Codex y Gemini, el procedimiento de comprobación (`talend-mcp setup --client <id>`, reiniciar, pedir `talend_guide`) con una columna de fecha y versión del cliente que rellena quien lo prueba.
- [ ] **Step 5: Commit** `docs: validación real de p2 y lista de comprobación por cliente`.

## Fase H: Decisiones del propietario

No son tareas de código. Cada una necesita una respuesta antes de ejecutarse.

| Decisión | Opciones | Recomendación |
|---|---|---|
| D1. Studio en vivo en CI | Runner autoalojado en una máquina con Studio y `STUDIO_ENABLED=true`, o seguir manual | Runner autoalojado si hay una máquina estable; si no, ejecutar la fase C antes de cada release |
| D2. Firma de binarios | Certificado Authenticode (coste, evita SmartScreen) o solo attestations (gratis) | Attestations ahora (T4); firma cuando haya usuarios fuera de la organización |
| D3. Historial de git | Reescribir con `git filter-repo` para quitar el correo y el nombre de proyecto (fuerza el push y rompe los tags publicados) o dejarlo | Dejarlo salvo que el cliente lo exija; ya no hay datos nuevos |
| D4. Protección de `main` | `gh api` para exigir los checks `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)` y `Plugin Java (Tycho)` y un `CODEOWNERS` con `* @AndresGaibor` | Hacerlo |

## Definición de «listo para producción»

| Puerta | Medida | Tarea |
|---|---|---|
| Diagnosticable | Todo fallo del audit trae mensaje; `talend-mcp audit` lo resume | T1, T2 |
| Artefacto probado | `smoke` verde en tres sistemas antes de publicar; attestations | T3, T4 |
| Vía en vivo estable | ≥ 99% en 100 refrescos, p95 < 15 s, bloqueo por diálogo ≤ 30 s con causa | T5 a T7 |
| Entorno declarado | `doctor` avisa de Studio no probado | T8 |
| Útil | ≥ 12 de 15 ejecuciones con un asistente real; `tools/list` < 12000 tokens | T9 |
| Actualizable | `talend-mcp update` | T10 |
| Catálogo coherente | Riesgo y `readOnlyHint` coinciden en todas las tools | T11 |
| Instalación fiable | Detección estricta; p2 probado en una copia; clientes con tabla de resultados | T12, T13 |
| Gobernado | D1 a D4 resueltas | Fase H |

## Orden recomendado

`T1 → T2 → T3 → T4` (sin Studio, ~1 día) → `T10 → T11 → T12` (sin Studio) → `T5 → T6 → T7 → T8` (con Studio y el propietario) → `T9` (con sesión del propietario) → `T13` y Fase H. Después se publica una versión con el `CHANGELOG` de cada fase.
