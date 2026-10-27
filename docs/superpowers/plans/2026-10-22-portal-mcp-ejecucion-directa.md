# Portal como instructor, MCP como ejecutor

> **For agentic workers:** ejecución inline en la sesión actual; cada tarea lleva pruebas antes de implementación.

**Goal:** el portal envía la guía SAS completa en un clic y el MCP crea o continúa el Job con la API nativa de Talend Studio.

**Architecture:** FastAPI recompone la instrucción estructurada del plan vigente y llama una vez a `talend_job_apply_custom_spec`. El MCP valida catálogo/propiedades con Studio y ejecuta apertura, creación, nodos, esquemas, contextos y conexiones por el Bridge; no escribe `.item` o `.properties`. El portal elimina el seguimiento manual por paso, conserva los datos técnicos faltantes y no ejecuta Jobs.

**Tech Stack:** Python/FastAPI/Pydantic, React/TypeScript/Vite, Bun/Zod, Java Eclipse Bridge, Talend Studio HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-21-integracion-portal-talend-mcp-design.md` (Addendum 2).

## Global Constraints

- Los Jobs se crean y modifican mediante las tools del MCP que usan la API de Studio.
- Los comentarios y mensajes visibles del MCP se escriben en español; identificadores de código en inglés.
- La instrucción se deriva del plan del portal; MCP no inventa conexiones, columnas ni traducciones SAS.
- Un Job parcial puede quedar en Studio con nodos identificados como borradores y advertencias técnicas.
- No ejecutar el Job SAS durante este trabajo.
- Conservar los cambios locales existentes y los dos commits remotos integrados en `main`.

## Review Focus

- Job en ruta heredada: apertura exacta de `process/job_dsc_appendtocustomerdb/PruebasWebSAS/job_dsc_appendtocustomerdb_0.1.item` sin seleccionar el editor activo equivocado.
- Reintento tras inserción parcial: no duplicar nodos/contextos ni borrar un Job preexistente.
- Componente no instalado o propiedad inexistente: no escribir el componente inválido; devolver una advertencia por paso.
- Plan con estado manual `validado_manualmente` o `descartado`: dichos estados no deben funcionar como aprobación ni filtro de ejecución.
- SAS dinámico sin esquema/conexión: conservar el aviso y omitir las conexiones que no se puedan confirmar.

---

### Task 1: Abrir Jobs por su ruta dentro del proyecto

**Files:**
- Modify: `src/modules/studio-bridge/adapters/http-studio-bridge.client.ts`
- Modify: `src/talend/studio/tools-job-operations.ts`
- Modify: `talend-studio-bridge/com.andres.talend.bridge/src/com/andres/talend/bridge/automation/JobRepository.java`
- Test: `tests/tools/job-operations-tools.test.ts`

**Interfaces:**
- `talend_job_open_in_studio` accepts `itemPath?: string`, project-relative and beginning with `process/` or `process_mr/`.
- `BridgeClient.openJob({name, version, itemPath})` forwards that path; Java validates the root and expected `<name>_<version>.item` basename before opening it.

- [x] Write a failing test proving `itemPath` is accepted and forwarded to Bridge.
- [x] Run the focused test and confirm it fails because the field is not yet supported.
- [x] Implement optional project-relative path opening without scanning the workspace or accepting absolute paths.
- [x] Run the focused test and `bun run typecheck`.

### Task 2: Make the MCP custom-spec tool the Studio API executor

**Files:**
- Create: `src/talend/studio/custom-spec-executor.ts`
- Modify: `src/talend/studio/tools-job-spec.ts`
- Modify: `src/talend/studio/apply-safety.ts` as required for target resolution.
- Test: `tests/tools/job-spec-tools.test.ts`

**Interfaces:**
- Reuse `talend_job_apply_custom_spec`; add structured portal `instructions` and per-component `tables`, `mapper`, `schema`, and draft metadata.
- MCP validates the requested component against the live Standard palette and `talend_studio_component_parameters` before writing.
- MCP creates/opens through `createJob`/`openJob`, then applies contexts, nodes, configuration, connections and a post-write node listing through Bridge methods.
- New Jobs may be rolled back through `deleteJob` only if this call created them and a required write fails. Existing Jobs are preserved for retry.

- [x] Write executor tests for catalog rejection before mutation, new Job operation ordering, matching existing Job resume, partial failure behavior, and no execution call.
- [x] Run the focused tests and confirm the new executor behavior is absent.
- [x] Implement the executor with an injected bridge boundary; remove direct custom-spec writes to `.item`/`.properties`.
- [x] Run focused tests, `bun run typecheck`, and `bun test`.

### Task 3: Send the full portal plan to one MCP call

**Files:**
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/apply_spec.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/adapter.py`
- Modify: `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/policy.py`
- Modify: `migrador-sasgrid-qlik/apps/api/main.py`
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_apply_spec.py`
- Test: `migrador-sasgrid-qlik/tests/unit/test_talend_adapter.py`

**Interfaces:**
- `POST /api/projects/{project_id}/plans/{program:path}/talend-apply` rebuilds the current typed instruction and applies it without requiring a user-facing preview token.
- `TalendAdapter.apply_custom_spec(arguments)` sends exactly one `talend_job_apply_custom_spec` MCP request.
- `instructions` includes source identity, macro/step instructions, properties, expressions, schema, dependencies, assumptions, evidence and unresolved details; legacy progress `status`/`note` is excluded.
- `talend_job_apply_custom_spec` receives the exact existing `.item` path relative to the Talend project when resuming an existing target.

- [x] Add failing tests for one MCP tool call, complete instruction payload, path normalization and status-independent apply eligibility.
- [x] Run focused tests and confirm the current multi-tool flow/status gate is detected.
- [x] Implement the single-call contract and ignore legacy manual progress status when deciding what the portal instructs.
- [x] Run focused tests and Python syntax/type checks available in the portal repository.

### Task 4: Remove manual progress and approval controls

**Files:**
- Modify: `migrador-sasgrid-qlik/apps/web/src/views/PlansTab.tsx`
- Modify: `migrador-sasgrid-qlik/apps/web/src/api.ts`
- Modify: `migrador-sasgrid-qlik/apps/web/src/types.ts`
- Modify: `migrador-sasgrid-qlik/apps/web/src/guide-export.ts`
- Remove: `migrador-sasgrid-qlik/apps/web/src/guide-progress.ts`
- Test: `migrador-sasgrid-qlik/apps/web/src/guide-export.test.mjs`

**Interfaces:**
- The primary button performs the apply action on its first click; no second “Crear Job” confirmation is shown.
- Per-step status selectors, confirmation dialogs, work notes, approval badges and progress counts are removed from the guide and exports.
- Technical missing data, component availability, confidence and apply result remain visible as information.

- [x] Add failing UI/export assertions that no manual progress states or confirmation dialog are rendered/exported and that the CTA calls apply directly.
- [x] Run the focused UI tests and confirm they fail against the current two-click/status workflow.
- [x] Implement the one-click flow and remove unused progress module wiring.
- [x] Run typecheck, tests, and build in the separate portal repository (historical verification).

### Task 5: Live smoke test in the configured test folder

**Files:**
- Update: `docs/GUIA-AGENTE.md`, `docs/PLAN-DE-PRUEBAS.md`, `docs/TALEND-STUDIO-INTERNALS.md`
- Verify: active portal API, MCP, Bridge and Talend Studio.

- [x] Open the current target using its exact project-relative path; verify the expected test Job is selected.
- [x] Invoke the portal’s one-click apply for `ci360-download-client/macros/dsc_appendtocustomerdb.sas`.
- [x] Verify node/context counts with `talend_job_list_nodes` and the portal result; confirm unresolved SAS inputs stay visible.
- [x] Confirm that no Job execution tool was called and update the operational guide with the smoke result.

Resultado del smoke test (2026-10-22): `job_dsc_appendtocustomerdb` quedó en `Process/PruebasWebSAS` con 6 nodos reutilizados y renombrados desde las instrucciones, 1 variable `context.range_id` y 0 conexiones. El portal informa aplicación parcial y datos SAS pendientes. La lectura no ejecutora `talend_job_problems` muestra 2 errores de diseño (variables vacías en `tSetGlobalVar`) y 6 avisos por falta de filas de entrada/salida; corresponden a valores, fuentes y esquemas que el SAS no permite inferir. No se compiló ni ejecutó el Job.
