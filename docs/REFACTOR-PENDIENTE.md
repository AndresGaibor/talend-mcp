# Plan de reduccion de pruebas lentas y refactor

Estado: en curso. Se prioriza no cambiar comportamiento de produccion y conservar las
pruebas de regresion utiles. Las mediciones contra Talend Studio son aparte de `bun test`.

## Cambios ya hechos

- Se sustituyeron los tests `tool-safety.test.ts`, `tool-schemas.test.ts`,
  `presentation/tools/core.test.ts`, `tool-registry.test.ts` y `tool-naming.test.ts` por
  `tests/tools/tool-conformance.test.ts`. Los tests anteriores mantenian listas y schemas
  duplicados; el test nuevo observa el registro real de tools. Se conservaron los tests de
  comportamiento de `tool-contracts.test.ts`.
- `tests/talend/server-smoke.test.ts` ahora crea el servidor una vez para ambos checks.
- `scripts/execution-check.ts` acepta `--suite <nombre>`, `--solo-fallidos` y `--validar`. Las
  suites son `humo`, `archivos`, `transformaciones`, `bd`, `control`, `contextos`, `orquestacion`,
  `codigo`, `aws`, `privacidad`, `calidad`, `formatos`, `sistema`, `conciliacion` y `otros`. Las
  corridas filtradas actualizan solo sus filas en el CSV, preservando resultados de otras suites.
- `scripts/execution-check.ts --desde <commit>` selecciona los escenarios cuyo objeto cambio
  en `escenarios-l5/<suite>/<escenario>.json` respecto a ese commit. Los escenarios eliminados no se ejecutan.
- La seleccion L5 se extrajo a `scripts/l5/scenario-selection.ts` con tests unitarios; operaciones
  de Postgres se separaron a `scripts/l5/postgres.ts`.
- `scripts/coverage.ts` acepta `--solo-pendientes`: excluye todo componente que haya compilado
  en cualquier CSV anterior de cobertura; incluye los nunca medidos y los que solo fallaron.
  Combinalo con `--family`, `--components` y `--compile`.
- El parseo/filtrado de los informes se separo a `scripts/coverage-selection.ts` y se prueba con
  un verde, un fallo y un componente no medido.
- La orquestacion de `scripts/coverage.ts` se separo a `scripts/coverage/`: opciones, seleccion,
  progreso/memoria, informe CSV y resumen. La entrada queda en 29 lineas y las piezas puras se
  prueban sin Studio en `tests/scripts/coverage-pieces.test.ts` (20 tests, ~50 ms).
- El cliente HTTP del bridge se separo por area en `src/modules/studio-bridge/adapters/`:
  `bridge-types.ts`, `bridge-transport.ts` (config, token, timeout y respuesta), workbench, job,
  contextos, nodos y cobertura. `http-studio-bridge.client.ts` queda como fabrica y fachada de 81
  lineas, con la misma clase y metodos. `tests/talend/bridge-client-routes.test.ts` intercepta
  `fetch` y comprueba rutas, metodo, cuerpo, token y manejo de errores sin Studio (7 tests, ~21 ms).
- La lectura de configuracion/token del bridge vive ahora en
  `src/modules/studio-bridge/adapters/bridge-config.ts`; el cliente HTTP conserva y reexporta la
  API publica anterior.
- `validateJobSpec` se extrajo a `src/talend/job-spec-validator.ts`; `job-generator.ts` mantiene
  su export anterior como fachada.
- La normalizacion de tipos y serializacion de columnas del generador vive en
  `src/talend/job-generator/columns.ts`; `normalizeColumnType` sigue exportado desde la fachada.
- Los schemas base y los schemas de jobs/componentes se separaron en
  `src/server/enriched/base-schemas.ts` y `src/server/enriched/jobs-components.schemas.ts`;
  `enriched-schemas.ts` mantiene las exportaciones y funciones públicas existentes.
- Los contratos de ejecucion y Studio/live se separaron en
  `src/server/enriched/execution-studio.schemas.ts` y se mantienen conectados desde la misma fachada.
- Los contratos de contextos y repositorio viven en `src/server/enriched/contexts-repository.schemas.ts`.
- Los contratos de análisis y de módulos (secrets, snapshots, datasets, deliverables, errores y
  validación) viven en `analysis.schemas.ts` y `modules.schemas.ts`, respectivamente.
- El test de conformidad ahora cubre schemas reales para borrar job, duplicar job y upsert de
  parametro de contexto, ademas de consultar el registro real.
- `tools-job-operations.ts` conserva `jobOperationsTools` como fachada y delega schemas,
  contextos, mantenimiento de Studio, diagnóstico/ejecución, catálogo y conexión validada a módulos
  por capacidad. `tools-bridge.ts` delega eventos e inspección activa en módulos separados.
- Los escenarios L5 se repartieron en un archivo por escenario dentro de su suite:
  `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json` (79 archivos, el mayor de 7 KB).
  El cargador `scripts/l5/scenario-files.ts` lee solo la suite pedida, valida en la misma pasada
  (nombre, job, nodos, conexiones, `pendiente` y suite correcta) y devuelve los problemas con la
  ruta exacta. `--desde` consulta el árbol de esa carpeta en git, pero solo lee la versión anterior
  de los archivos que cambiaron: dos llamadas a git y un `git show` por archivo modificado.
- `scripts/install-bridge.ts` pasó de 828 a ~220 líneas: detección de Studio, compilación, carga en
  caliente e instalación p2 viven en `scripts/lib/`.
- `scripts/execution-check.ts` pasó de 1080 a 149 líneas. El arnés quedó dividido en
  `scripts/l5/`: `scenario-types` (contrato), `scenario-report` (CSV), `scenario-expectations`
  (comparaciones), `scenario-filters` (cambios en git), `job-mounter` + `job-nodes` + `job-wiring`
  (montaje), `studio-retry` + `studio-compile` + `studio-execute` (Studio) y `scenario-runner`
  (orquestación). Ningún archivo pasa de 200 líneas.
- `scripts/studio-job.ts` pasó de 884 a 153 líneas: cada fase vive en `scripts/studio-job/`
  (`fase0`, `fase1`, `fase1b`, `fase2`, `fase3`, `fase4`, `fase5`, `fase6`, `fase9`) y comparte
  `shared.ts` (tipos, columnas de prueba e impresión). El CLI valida el comando antes de crear el
  cliente del bridge y carga la fase bajo demanda: un comando desconocido falla en ~50 ms sin
  conectar con Studio.
- `scripts/make-testdata.ts` pasó de 412 a 76 líneas: CSV/JSON, XLSX (con su escritor ZIP) y los
  datos fijos de Postgres viven en `scripts/testdata/`. Acepta `--out <carpeta>` para regenerar sin
  borrar `testdata/`, y sus generadores tienen pruebas propias que no tocan el disco. Al comparar la
  regeneración con `testdata/sql/init.sql` apareció una deriva: el generador no incluía
  `l5_salida` ni la FK `NOT VALID`. Se corrigió el generador para que regenerar no rompa los
  escenarios que escriben en esa tabla.
  `tests/scripts/studio-job-fases.test.ts` comprueba que cada fase registrada resuelve su módulo y
  que no queda ningún archivo de fase sin registrar.
- Los registros de `tools-execution.ts`, `tools-bridge.ts`, `tools-mastery.ts`,
  `tools-job-operations.ts` y `tools-job-spec.ts` quedaron como fachadas pequeñas; sus
  operaciones se repartieron por capacidad y conservan el orden público de registro.
- El registro de tools dejó de ser una cadena de booleanos: `PRESET_RULES` en
  `src/server/registered-tools.ts` define cada preset con una función y de ahí salen el filtro y la
  validación. Las anotaciones de seguridad se movieron a
  `src/presentation/server/tool-safety.ts`.
- `docs/TALEND-STUDIO-INTERNALS.md` es ahora un índice de 91 líneas; las 60 secciones viven en
  `docs/studio-internals/` repartidas en 7 archivos por tema, conservando la numeración.
- `docs/GUIA-AGENTE.md` (36 KB) y `docs/PLAN-DE-PRUEBAS.md` (40 KB) quedaron como índices de 14
  líneas. El contenido vive en `docs/guia-agente/` (5 archivos) y `docs/plan-de-pruebas/` (4
  archivos), con el mayor de 17 KB; los enlaces relativos se reescribieron y se comprobó que todos
  resuelven.
- Los CLI comparten `src/shared/cli/ui.ts`: un icono por nivel, color solo en TTY y
  `TALEND_MCP_LOG=quiet|normal|verbose`. `bun run doctor` resume Studio, bridge, MCP y configuración.
- El servidor HTTP no registra las 230 tools al arrancar: `initialize`, `tools/list` y `tools/call`
  responden sobre un catálogo ya serializado. El `McpServer` y el transporte SSE se crean solo si
  un cliente pide `text/event-stream`. Arranque: 797 → 337 ms con `canonical`, 314 ms con `agent`
  (46 tools, 90 KB); `tools/list` tarda 2–3 ms.
- `toCallToolResult` vive en `src/presentation/server/call-tool-result.ts` y se reexporta desde
  `new-server.ts`: importarlo no carga el registro de tools (el test correspondiente pasó de
  833 a 270 ms y deja de arrastrar 230 schemas).
- Las respuestas JSON-RPC (`initialize`, `tools/list`, `ping`, recursos y prompts) están en
  `src/presentation/server/json-rpc.ts`, con `tests/presentation/json-rpc.test.ts` sobre una
  respuesta falsa: 6 tests en ~12 ms, sin abrir puertos ni cargar schemas.
- Se retiró `TALEND_MCP_LIVE`: `index.ts` la leía y la pasaba por dos capas, pero ningún código la
  usaba. `createNewMcpServer` y `runNewStdioServer` ya no aceptan opciones que se ignoraban. En
  `src/config/env.ts` quedaron declaradas `TALEND_MCP_*`, `TALEND_LOG_DIR` y las banderas
  `TALEND_BRIDGE_AUTO_INSTALL` y `TALEND_DISABLE_AUTODETECT`, documentadas en el README.
- El preset por defecto es `agent` (46 tools): el `initialize` inyecta 90 KB en vez de 371 KB.
  `canonical` y `all` siguen disponibles para clientes que necesiten el catálogo completo.
- La validación de fixtures corre en la misma pasada de la carga (`scenario-files.ts` +
  `scenario-validation.ts`): nombre con categoría, job, nodos, conexiones, `pendiente` y suite
  correcta, con la ruta exacta en el mensaje. Un JSON roto, un nombre duplicado o una suite
  desconocida terminan con código 1 y un renglón, no con una traza.
- `tests/talend/l5-scenario-files.test.ts` prueba el árbol real y casos rotos en un directorio
  temporal (15 tests, ~50 ms); `l5-scenario-selection.test.ts` quedó como prueba unitaria pura, sin
  tocar fixtures.
- El arnés carga el bridge, el índice de componentes y el runner solo cuando hay escenarios que
  ejecutar: `l5:validar` pasó de ~320 a ~65 ms y `--validar --suite bd`, a 32 ms, porque no importa
  Studio ni Postgres. Las pruebas nuevas por módulo son granulares:
  `tests/l5/scenario-report.test.ts`, `scenario-expectations.test.ts`, `studio-retry.test.ts`,
  `job-nodes.test.ts`, `cli-args.test.ts` y `scenario-filters.test.ts` (26 tests, ~0,4 s entre las
  seis, incluida una prueba de `--desde` con un repositorio git temporal).

Ejemplos:

```powershell
bun run l5:validar                                        # valida los 88 escenarios sin abrir Studio
bun run l5:validar --suite bd                             # solo una suite
bun run scripts/execution-check.ts --suite transformaciones
bun run scripts/execution-check.ts --solo-fallidos
bun run scripts/execution-check.ts --desde HEAD
bun run scripts/coverage.ts --family File/Input --compile --solo-pendientes --out testdata/cobertura-l4-file-input-pendiente.csv
```

## Verificacion

`bun run typecheck` limpio y `bun test`: **440 tests en 79 archivos, 0 fallos**. El archivo más
lento es `server-smoke.test.ts`, porque valida la conversión de schemas de las tools; se conserva a
propósito como prueba de contrato. `l5:validar` recorre 88 escenarios de las 14 suites en ~65 ms y
sale con código 1 ante una suite desconocida o un fixture roto, comprobado con un archivo temporal
que se elimina después.
La validacion real contra Studio sigue incompleta: en la suite `bd` pasaron 5 de 8 escenarios;
tres fallaron porque el job no estaba compilado y faltaba `target/classpath.jar`. Los filtros L5/L4
necesitan validacion con el entorno de integracion antes de considerarlos operativamente verificados.

## Archivos grandes y candidatos a separar

No dividir un archivo solo por superar cierto numero de lineas. La extraccion debe respetar las
fronteras de responsabilidad y conservar las interfaces exportadas.

| Archivo | Lineas aproximadas | Responsabilidad mezclada | Tratamiento propuesto |
|---|---:|---|---|
| `src/server/enriched-schemas.ts` | 152 | fachada de outputs y alias históricos | todos los grupos de schemas están separados en `src/server/enriched/`; se conservan la fachada y los alias |
| `src/talend/job-generator.ts` | 416 | generacion de jobs y joblets | validacion y columnas extraidas; separar joblet solo tras revisar dependencias comunes |
| `talend-studio-bridge/.../NodeOperations.java` | 472 | ciclo de vida del nodo y operaciones de modelo/UI | conexiones y consultas de solo lectura extraidas a `NodeConnectionOperations` y `NodeInspectionOperations`; evaluar el resto por responsabilidad y mantener `UiThread.sync` |
| `talend-studio-bridge/.../WorkbenchService.java` | 519 | consultas y manipulacion de workbench | apertura de recursos/editor Talend extraida a `TalendJobEditorOpener`; no dividir el resto por tamaño solamente |
| `talend-studio-bridge/.../BridgeServer.java` | 686 | transporte HTTP y despacho de rutas | revisar límites por familias de endpoints antes de extraer; conservar rutas y anotaciones de seguridad |

Resueltos en esta etapa (se retiraron de la tabla): `scripts/execution-check.ts` (dividido en
`scripts/l5/`), `scripts/studio-job.ts` (dividido en `scripts/studio-job/`),
`scripts/make-testdata.ts` (dividido en `scripts/testdata/`), `scripts/coverage.ts` (dividido en
`scripts/coverage/`), `src/talend/editor.ts` (dividido en `src/talend/editor/`),
`http-studio-bridge.client.ts` (dividido por area en `studio-bridge/adapters/bridge-*.ts`),
`scripts/install-bridge.ts`, `docs/TALEND-STUDIO-INTERNALS.md`, `docs/GUIA-AGENTE.md`,
`docs/PLAN-DE-PRUEBAS.md` y el archivo unico `escenarios-l5.json`. En el bridge Java se redujeron
`ComponentConfigurator.java` (972 → 206 líneas), `WorkbenchService.java` (894 → 519),
`NodeOperations.java` (893 → 472) y `CoverageChecker.java` (818 → 289). Las operaciones de nodos
delegan conexiones e inspección en clases propias; la cobertura delega la prueba del componente,
la topología temporal y el schema a tres clases enfocadas. Los builds rápidos compilan el plugin,
pero no sustituyen la validación funcional dentro de Studio.

## Orden de trabajo restante

1. Validar en entorno Studio las suites L5, `--solo-fallidos`, preservacion de CSV y `--desde`
   contra la carpeta `escenarios-l5/`.
2. Ejecutar cobertura L4 con `--solo-pendientes` y validar un verde, un fallo y uno no medido.
3. Continuar los splits TypeScript por dominio (joblet y tools), con fachada compatible
   y pruebas de comportamiento antes/despues. En `tools-job-operations.ts`, los schemas,
   los handlers de contexto, mantenimiento, diagnóstico/ejecución, catálogo y conexión validada ya
   están separados; queda evaluar el resto de operaciones de nodo.
4. Revisar el transporte HTTP del bridge ya dividido: si aparece una operacion nueva, va en el
   archivo de su area (`bridge-node.client.ts`, `bridge-context.client.ts`...), no en la fachada.
5. Revisar el contenido de `docs/plan-de-pruebas/` y `docs/guia-agente/` cuando cambien las fases o
   el flujo: los índices se mantienen cortos y el detalle va en el archivo del tema.
   `docs/CATALOGO-DE-TOOLS.md` se genera con `bun run docs:tools`: no se edita a mano.
6. Revisar los candidatos Java restantes (`BridgeServer`, `RepositoryContexts` y
   `TalendIntrospectionService`) y extraer solo si hay una frontera funcional comprobable. La suite
   está verde; la validación real de L5 en Studio sigue pendiente por la ausencia de
   `target/classpath.jar` en tres escenarios de la suite `bd`.

`scripts/studio-job.ts` se conserva: se usa en `docs/guia-agente/` para hablar directo con el
bridge, y sus fases ya están separadas en `scripts/studio-job/`.
