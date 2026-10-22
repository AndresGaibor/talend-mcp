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
- `scripts/execution-check.ts` acepta `--suite <nombre>` y `--solo-fallidos`. Las suites son
  `humo`, `archivos`, `transformaciones`, `bd`, `control`, `contextos`, `orquestacion`,
  `codigo` y `otros`. Las corridas filtradas actualizan solo sus filas en el CSV, preservando
  resultados de otras suites.
- `scripts/execution-check.ts --desde <commit>` selecciona los escenarios cuyo objeto cambio
  en `escenarios-l5.json` respecto a ese commit. Los escenarios eliminados no se ejecutan.
- La seleccion L5 se extrajo a `scripts/l5/scenario-selection.ts` con tests unitarios; operaciones
  de Postgres se separaron a `scripts/l5/postgres.ts`.
- `scripts/coverage.ts` acepta `--solo-pendientes`: excluye todo componente que haya compilado
  en cualquier CSV anterior de cobertura; incluye los nunca medidos y los que solo fallaron.
  Combinalo con `--family`, `--components` y `--compile`.
- El parseo/filtrado de los informes se separo a `scripts/coverage-selection.ts` y se prueba con
  un verde, un fallo y un componente no medido.
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

Ejemplos:

```powershell
bun run scripts/execution-check.ts --suite transformaciones
bun run scripts/execution-check.ts --solo-fallidos
bun run scripts/execution-check.ts --desde HEAD
bun run scripts/coverage.ts --family File/Input --compile --solo-pendientes --out testdata/cobertura-l4-file-input-pendiente.csv
```

## Verificacion

Tras corregirse el error de sintaxis que habia en el archivo no seguido
`src/modules/guide/domain/task-catalog.ts`, pasaron `bun run typecheck` y `bun test`:
**253 tests en 48 archivos, 0 fallos** (la ultima corrida tardo 3,10 s; bajaron al retirar pruebas
duplicadas migradas a conformidad). El adaptador, la seleccion
de suites, el filtrado de coverage y los generadores de job/joblet tambien pasaron sus tests
dirigidos. `bun build` de `execution-check.ts`, `coverage.ts` y el cliente HTTP del bridge termino
correctamente.
No se ejecutaron mediciones contra Studio; los filtros L5/L4 necesitan validacion con el entorno
de integracion antes de considerarlos operativamente verificados.

## Archivos grandes y candidatos a separar

No dividir un archivo solo por superar cierto numero de lineas. La extraccion debe respetar las
fronteras de responsabilidad y conservar las interfaces exportadas.

| Archivo | Lineas aproximadas | Responsabilidad mezclada | Tratamiento propuesto |
|---|---:|---|---|
| `scripts/execution-check.ts` | 950 | CLI, reintentos de Studio, montaje, ejecucion y CSV | ya separa seleccion y Postgres; quedan `studio-runner`, `job-mounter` y `report` |
| `src/modules/studio-bridge/adapters/http-studio-bridge.client.ts` | 675 | rutas portables, protocolo HTTP y mas de 60 operaciones | configuracion extraida; quedan transporte/rutas y clientes por area; riesgo medio por API amplia |
| `src/server/enriched-schemas.ts` | 118 | fachada de outputs y alias históricos | todos los grupos de schemas están separados en `src/server/enriched/`; se conservan la fachada y los alias |
| `src/talend/studio/tools-job-operations.ts` | 282 | operaciones de job/nodos y utilidades restantes | schemas, contextos, mantenimiento, diagnóstico/ejecución, catálogo y conexión validada se separaron en módulos por capacidad; se conserva el orden |
| `src/talend/studio/tools-bridge.ts` | 305 | registro de tools de bridge y workbench | eventos, inspección activa, ejecución y edición de editores se separaron en módulos; quedan grupos de workbench/launch, preservando orden y nombres |
| `src/talend/job-generator.ts` | 360 | generacion de jobs y joblets | validacion y columnas extraidas; separar joblet solo tras revisar dependencias comunes |
| `src/talend/editor.ts` | 405 | edicion de XML de nodos, esquemas, conexiones, contextos y propiedades | separar por recurso, manteniendo la fachada publica |
| `scripts/install-bridge.ts` | 700 | deteccion, compilacion, instalacion P2, hot reload y limpieza | separar por etapa; no tocar durante cambios del bridge/hot reload |
| `talend-studio-bridge/.../ComponentConfigurator.java` | 900 | configuracion de nodos y parametros/tablas | candidato de mayor riesgo; separar solo con pruebas de integracion contra Studio |
| `talend-studio-bridge/.../NodeOperations.java` | 830 | ciclo de vida del nodo y varias operaciones de modelo/UI | separar por operacion con cuidado de `UiThread.sync` |
| `talend-studio-bridge/.../WorkbenchService.java` | 790 | consultas y manipulacion de workbench | medir cohesión antes de extraer; no separar por tamaño solamente |
| `talend-studio-bridge/.../CoverageChecker.java` | 765 | recorrido, montaje, compilacion y progreso de cobertura | dividir recorrido y reporte; mantener cancelacion y guardas de memoria |

`docs/TALEND-STUDIO-INTERNALS.md` tiene cerca de 1.900 lineas y ya cuenta con indice por tema.
Si se parte, preservar las referencias numeradas existentes o dar una tabla de equivalencias.

## Orden de trabajo restante

1. Validar en entorno Studio las suites L5, `--solo-fallidos`, preservacion de CSV y `--desde`.
2. Ejecutar cobertura L4 con `--solo-pendientes` y validar un verde, un fallo y uno no medido.
3. Continuar los splits TypeScript por dominio (`editor`, joblet y tools), con fachada compatible
   y pruebas de comportamiento antes/despues. En `tools-job-operations.ts`, los schemas,
   los handlers de contexto, mantenimiento, diagnóstico/ejecución, catálogo y conexión validada ya
   están separados; queda evaluar el resto de operaciones de nodo.
4. Evaluar separacion del transporte HTTP y las herramientas del bridge sin cambiar orden de registro.
5. Dejar Java del bridge para una fase posterior con suite verde y Studio disponible.

No se borro `scripts/studio-job.ts`: aunque no aparezcan referencias de codigo, puede ser una utilidad
manual. Confirmar su uso antes de retirarlo.
