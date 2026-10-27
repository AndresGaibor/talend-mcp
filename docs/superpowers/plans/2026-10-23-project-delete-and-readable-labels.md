# Eliminación de proyecto y etiquetas legibles de Talend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir borrado confirmado de proyectos del portal y etiquetas breves para componentes Talend sin perder la identidad de sus pasos SAS.

**Architecture:** FastAPI y Store validan y eliminan los datos propios del proyecto, bloqueando operaciones activas; React presenta la confirmación y actualiza la navegación. El portal genera etiquetas visibles compactas y el ejecutor MCP conserva compatibilidad con marcadores antiguos y nuevos. Los Jobs se actualizan mediante la API de Studio cuando su destino e identidad son reconocibles.

**Tech Stack:** Python, FastAPI, SQLite, React, TypeScript, Bun.

**Spec:** `docs/superpowers/specs/2026-10-23-project-delete-and-readable-labels-design.md`

## Global Constraints

- Los Jobs Talend permanecen intactos al eliminar un proyecto del portal.
- Ningún proyecto se elimina mientras análisis o implementación estén activos.
- No se sobrescribe un Job homónimo de identidad o ubicación ambigua.
- Las etiquetas visibles son cortas; los identificadores internos conservan su función.

## Review Focus

- Nombre de confirmación incorrecto o proyecto inexistente: no borrar.
- Job en lote activo: no borrar y responder con conflicto claro.
- Proyecto heredado sin ZIP: su metadata y directorio también se eliminan.
- Etiqueta SAS larga y reintento de Job con etiqueta antigua: conservar el mapeo del paso.
- Eliminar un proyecto no llama al MCP ni borra objetos Talend.

---

### Task 1: Borrado seguro de proyectos

**Files:** `src/sas_grid_migrator/persistence/store.py`, `apps/api/main.py`, `tests/unit/test_store_project_state.py`, `tests/integration/test_api_zip_projects.py`

- [x] Probar confirmación, cascade de filas/directorio, proyecto inexistente y bloqueo de estado activo.
- [x] Añadir eliminación transaccional con cuarentena del directorio propio del proyecto.
- [x] Añadir `DELETE /api/projects/{project_id}` que exige el nombre exacto.
- [x] Ejecutar pruebas enfocadas.

### Task 2: Confirmación de borrado en el portal

**Files:** `apps/web/src/api.ts`, `apps/web/src/views/ProjectView.tsx`, `apps/web/src/styles.css`, `apps/web/src/api.test.mjs`, nuevo test de `ProjectView`.

- [x] Probar llamada DELETE y presencia de confirmación por nombre.
- [x] Añadir botón destructivo en el encabezado y modal con alcance, bloqueo activo y estado de error.
- [x] Volver a Mis proyectos después de borrar y ejecutar pruebas/build de la UI.

### Task 3: Etiquetas cortas con identidad estable

**Files:** `src/sas_grid_migrator/talend_adapter/apply_spec.py`, `tests/unit/test_talend_apply_spec.py`, `src/talend/studio/custom-spec-executor.ts`, `tests/tools/custom-spec-executor.test.ts`.

- [x] Probar etiqueta breve con número SAS y migración de etiquetas antiguas.
- [x] Generar etiquetas visibles con propósito conciso y sufijo `· SAS <n>`.
- [x] Normalizar marcadores antiguos `op_<n>_*` y nuevos para reconciliar nodos existentes por Studio.
- [x] Ejecutar typecheck/tests MCP y tests Python enfocados.

### Task 4: Verificación

- [x] Ejecutar suite Python, pruebas frontend y build disponibles; anotar fallos de baseline sin modificar artefactos de prueba ajenos.
- [x] Revisar diff y `git status` en ambos repositorios.

Resultado de verificación: MCP `298 passed`; web `23 passed` y build/typecheck correctos; Python `169 passed, 1 skipped`. Siguen dos fallos en los fixtures sintéticos existentes: evidencia de `submit_daily_grid.sh` esperaba línea 7 y ahora está en la 5; ese fixture tampoco declara prioridad en sus primeras dos líneas. Ninguno afecta las pruebas nuevas de borrado o etiquetas.
